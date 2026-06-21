"""HTTP integration tests for ``POST /api/v1/refs/resolve`` — dual-engine (step 5-3).

Covers:
- Resolve OK (title + uuid for own objects)
- Batch mixte (existing + nonexistent ref_nos)
- Cross-user deny-by-default (T-084/T-085, T-172)
- Unknown / disabled prefix → exists=false
- Order preservation
- Auth required
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from halo_api.accounts.models import EmailToken, User
from halo_api.core import db as db_mod
from halo_api.main import app

# ── Helpers ──────────────────────────────────────────────────────────────────


async def _fetch_csrf(c: AsyncClient) -> str:
    r = await c.get("/api/v1/auth/csrf")
    assert r.status_code == 200
    token: str = r.json()["token"]
    return token


def _csrf_post(c: AsyncClient, path: str, csrf: str, **kw):  # type: ignore[no-untyped-def]
    return c.post(
        path,
        headers={"X-CSRF-Token": csrf, "Content-Type": "application/json"},
        **kw,
    )


async def _register_and_login(
    c: AsyncClient,
    email: str = "resolve-test@test.local",
) -> AsyncClient:
    """Register, verify, and log in. Returns the client with session cookie."""
    csrf = await _fetch_csrf(c)

    r = await _csrf_post(
        c,
        "/api/v1/auth/register",
        csrf,
        json={
            "email": email,
            "password": "secret1234",
            "first_name": "Resolve",
            "last_name": "Tester",
        },
    )
    assert r.status_code == 201, f"Register failed: {r.text}"

    # Verify user directly in DB
    sf = async_sessionmaker(db_mod.engine, class_=AsyncSession, expire_on_commit=False)
    async with sf() as s:
        result = await s.execute(
            select(EmailToken).where(EmailToken.purpose == "verify")
        )
        et = result.scalars().first()
        if et is not None:
            et.used_at = datetime.now(UTC)
        user_result = await s.execute(select(User).where(User.email == email))
        user = user_result.scalar_one()
        user.is_verified = True
        await s.commit()

    # Login
    csrf2 = await _fetch_csrf(c)
    r = await _csrf_post(
        c,
        "/api/v1/auth/login",
        csrf2,
        json={"email": email, "password": "secret1234"},
    )
    assert r.status_code == 200, f"Login failed: {r.text}"

    return c


async def _create_list(
    c: AsyncClient, title: str, list_type: str = "tasks"
) -> dict[str, Any]:
    """Create a list via the API and return the JSON response."""
    csrf = await _fetch_csrf(c)
    r = await _csrf_post(
        c,
        "/api/v1/modules/lists",
        csrf,
        json={"title": title, "list_type": list_type},
    )
    assert r.status_code == 201, f"Create list failed: {r.text}"
    return dict(r.json())


async def _resolve(
    c: AsyncClient, refs: list[dict[str, Any]], context: str = "personal"
) -> dict[str, Any]:
    """Call the refs resolve endpoint and return the JSON response."""
    csrf = await _fetch_csrf(c)
    r = await _csrf_post(
        c,
        "/api/v1/refs/resolve",
        csrf,
        json={"refs": refs, "context": context},
    )
    assert r.status_code == 200, f"Resolve failed: {r.text}"
    return dict(r.json())


# ── Resolve OK ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_own_list_returns_title_and_uuid(
    http_client: AsyncClient,
) -> None:
    """Resolving the caller's own list returns exists=true with title+uuid."""
    await _register_and_login(http_client)
    created = await _create_list(http_client, "Courses hebdomadaires")

    data = await _resolve(
        http_client,
        [{"tag_prefix": "LIST", "ref_no": created["ref_no"]}],
    )

    assert len(data["results"]) == 1
    r = data["results"][0]
    assert r["tag_prefix"] == "LIST"
    assert r["ref_no"] == created["ref_no"]
    assert r["exists"] is True
    assert r["title"] == "Courses hebdomadaires"
    assert r["uuid"] == created["id"]


@pytest.mark.asyncio
async def test_resolve_multiple_own_lists(
    http_client: AsyncClient,
) -> None:
    """Resolving several of the caller's lists returns all of them."""
    await _register_and_login(http_client)
    a = await _create_list(http_client, "Liste A")
    b = await _create_list(http_client, "Liste B")

    data = await _resolve(
        http_client,
        [
            {"tag_prefix": "LIST", "ref_no": a["ref_no"]},
            {"tag_prefix": "LIST", "ref_no": b["ref_no"]},
        ],
    )

    assert len(data["results"]) == 2
    assert data["results"][0]["title"] == "Liste A"
    assert data["results"][1]["title"] == "Liste B"
    assert all(r["exists"] for r in data["results"])


# ── Batch mixte (existing + nonexistent) ─────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_batch_mixed_existing_and_nonexistent(
    http_client: AsyncClient,
) -> None:
    """Existing refs return data; nonexistent ref_nos return exists=false."""
    await _register_and_login(http_client)
    created = await _create_list(http_client, "Ma liste")

    # ref_no 999 does not exist for this user
    data = await _resolve(
        http_client,
        [
            {"tag_prefix": "LIST", "ref_no": created["ref_no"]},
            {"tag_prefix": "LIST", "ref_no": 999},
        ],
    )

    assert len(data["results"]) == 2

    r1 = data["results"][0]
    assert r1["exists"] is True
    assert r1["title"] == "Ma liste"
    assert r1["uuid"] == created["id"]

    r2 = data["results"][1]
    assert r2["exists"] is False
    assert r2["title"] is None
    assert r2["uuid"] is None


# ── Order preservation ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_preserves_request_order(
    http_client: AsyncClient,
) -> None:
    """Results appear in the exact order of the request entries."""
    await _register_and_login(http_client)
    a = await _create_list(http_client, "First")
    b = await _create_list(http_client, "Second")

    data = await _resolve(
        http_client,
        [
            {"tag_prefix": "LIST", "ref_no": b["ref_no"]},
            {"tag_prefix": "LIST", "ref_no": a["ref_no"]},
            {"tag_prefix": "LIST", "ref_no": 404},
        ],
    )

    titles = [r["title"] for r in data["results"]]
    exists = [r["exists"] for r in data["results"]]
    assert titles == ["Second", "First", None]
    assert exists == [True, True, False]


# ── Unknown prefix ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_unknown_prefix_returns_not_found(
    http_client: AsyncClient,
) -> None:
    """A tag with a prefix that doesn't match any module → exists=false."""
    await _register_and_login(http_client)

    data = await _resolve(
        http_client,
        [{"tag_prefix": "NOPE", "ref_no": 1}],
    )

    assert len(data["results"]) == 1
    r = data["results"][0]
    assert r["tag_prefix"] == "NOPE"
    assert r["ref_no"] == 1
    assert r["exists"] is False
    assert r["title"] is None
    assert r["uuid"] is None


# ── Cross-user deny-by-default (T-084/T-085, T-172) ─────────────────────────


@pytest.mark.asyncio
async def test_resolve_cross_user_deny_by_default(
    http_client: AsyncClient,
) -> None:
    """User B resolving user A's ref_no → exists=false, no title/uuid leak."""
    # User A
    await _register_and_login(http_client, "user-a-resolve@test.local")
    created_a = await _create_list(http_client, "Secret de A")

    # User B — fresh client (separate cookie jar)
    client_b = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        await _register_and_login(client_b, "user-b-resolve@test.local")

        # User B tries to resolve A's ref_no
        data = await _resolve(
            client_b,
            [{"tag_prefix": "LIST", "ref_no": created_a["ref_no"]}],
        )

        assert len(data["results"]) == 1
        r = data["results"][0]
        assert r["tag_prefix"] == "LIST"
        assert r["ref_no"] == created_a["ref_no"]
        assert r["exists"] is False, "Cross-user ref must be denied (exists=false)"
        assert r["title"] is None, "Title must not leak cross-user"
        assert r["uuid"] is None, "UUID must not leak cross-user"
    finally:
        await client_b.aclose()


@pytest.mark.asyncio
async def test_resolve_cross_user_batch_mixed(
    http_client: AsyncClient,
) -> None:
    """In a batch mixing own + cross-user refs, cross-user ones are denied."""
    await _register_and_login(http_client, "owner@test.local")
    own_a = await _create_list(http_client, "Own List A")
    own_b = await _create_list(http_client, "Own List B")

    client2 = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        await _register_and_login(client2, "intruder@test.local")

        # Intruder tries to resolve owner's refs only (no own lists).
        # Every entry must be denied because ref_nos are scoped per user.
        data = await _resolve(
            client2,
            [
                {"tag_prefix": "LIST", "ref_no": own_a["ref_no"]},
                {"tag_prefix": "LIST", "ref_no": own_b["ref_no"]},
            ],
        )

        results = data["results"]
        assert len(results) == 2

        assert results[0]["exists"] is False
        assert results[0]["title"] is None
        assert results[0]["uuid"] is None
        assert results[1]["exists"] is False
        assert results[1]["title"] is None
        assert results[1]["uuid"] is None
    finally:
        await client2.aclose()


# ── Auth required ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_requires_auth(http_client: AsyncClient) -> None:
    """Unauthenticated requests are rejected (403 CSRF or 401 auth)."""
    r = await http_client.post(
        "/api/v1/refs/resolve",
        json={"refs": [{"tag_prefix": "LIST", "ref_no": 1}]},
    )
    # CSRF middleware runs before auth on POST → 403 when no CSRF token.
    # Either 401 or 403 is a correct rejection for unauthenticated POST.
    assert r.status_code in (401, 403)


# ── Input validation ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_empty_refs_rejected(
    http_client: AsyncClient,
) -> None:
    """An empty refs list is rejected with 422 (min_length=1)."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    r = await _csrf_post(
        http_client,
        "/api/v1/refs/resolve",
        csrf,
        json={"refs": [], "context": "personal"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_resolve_ref_no_zero_rejected(
    http_client: AsyncClient,
) -> None:
    """ref_no < 1 is rejected with 422 (ge=1)."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    r = await _csrf_post(
        http_client,
        "/api/v1/refs/resolve",
        csrf,
        json={"refs": [{"tag_prefix": "LIST", "ref_no": 0}]},
    )
    assert r.status_code == 422


# ── Disabled module ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_disabled_module_returns_not_found(
    http_client: AsyncClient,
) -> None:
    """Resolving a tag whose module is disabled → exists=false."""
    await _register_and_login(http_client)

    # Disable the lists module via the DB
    from halo_api.core import db as db_mod2
    from halo_api.modules.registry import disable

    async with db_mod2.async_session() as s:
        await disable(s, "lists")
        await s.commit()

    # Now resolving any LIST ref must return exists=false
    data = await _resolve(
        http_client,
        [{"tag_prefix": "LIST", "ref_no": 1}],
    )

    assert len(data["results"]) == 1
    r = data["results"][0]
    assert r["exists"] is False
    assert r["title"] is None

    # Re-enable so subsequent tests aren't affected
    from halo_api.modules.registry import enable

    async with db_mod2.async_session() as s:
        await enable(s, "lists")
        await s.commit()


# ── CSRF protection ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_requires_csrf(http_client: AsyncClient) -> None:
    """POST without a valid CSRF token is rejected with 403."""
    await _register_and_login(http_client)

    r = await http_client.post(
        "/api/v1/refs/resolve",
        headers={"Content-Type": "application/json"},
        json={"refs": [{"tag_prefix": "LIST", "ref_no": 1}]},
    )
    assert r.status_code == 403


# ── Bounds validation ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_too_many_refs_rejected(
    http_client: AsyncClient,
) -> None:
    """A request with > 100 refs is rejected with 422."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    r = await _csrf_post(
        http_client,
        "/api/v1/refs/resolve",
        csrf,
        json={
            "refs": [{"tag_prefix": "LIST", "ref_no": 1}] * 101,
            "context": "personal",
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_resolve_ref_no_overflow_rejected(
    http_client: AsyncClient,
) -> None:
    """A ref_no beyond the Integer column max is rejected with 422."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    r = await _csrf_post(
        http_client,
        "/api/v1/refs/resolve",
        csrf,
        json={
            "refs": [{"tag_prefix": "LIST", "ref_no": 9_999_999_999}],
            "context": "personal",
        },
    )
    assert r.status_code == 422
