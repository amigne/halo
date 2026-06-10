"""HTTP integration tests for /users/me endpoints — dual-engine (T-172).

Tests profile retrieval, partial update with validation, notification
preference upsert, and authentication requirements.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from halo_api.accounts.models import User
from halo_api.core import db as db_mod

# ── Helpers ──────────────────────────────────────────────────────────────────


async def _fetch_csrf(c: AsyncClient) -> str:
    """GET /auth/csrf and return the token value."""
    r = await c.get("/api/v1/auth/csrf")
    assert r.status_code == 200
    token: str = r.json()["token"]
    return token


def _csrf_patch(  # type: ignore[no-untyped-def]
    c: AsyncClient, path: str, csrf: str, **kw
):
    """PATCH *path* with CSRF header."""
    return c.patch(
        path,
        headers={
            "X-CSRF-Token": csrf,
            "Content-Type": "application/json",
        },
        **kw,
    )


def _csrf_put(  # type: ignore[no-untyped-def]
    c: AsyncClient, path: str, csrf: str, **kw
):
    """PUT *path* with CSRF header."""
    return c.put(
        path,
        headers={
            "X-CSRF-Token": csrf,
            "Content-Type": "application/json",
        },
        **kw,
    )


def _csrf_post(  # type: ignore[no-untyped-def]
    c: AsyncClient, path: str, csrf: str, **kw
):
    """POST *path* with CSRF header."""
    return c.post(
        path,
        headers={
            "X-CSRF-Token": csrf,
            "Content-Type": "application/json",
        },
        **kw,
    )


async def _register_and_login(
    c: AsyncClient,
    email: str = "user-test@test.local",
) -> AsyncClient:
    """Register, verify, and log in. Returns the client with session cookie."""
    from datetime import UTC, datetime

    from halo_api.accounts.models import EmailToken

    csrf = await _fetch_csrf(c)

    # Register
    r = await _csrf_post(
        c,
        "/api/v1/auth/register",
        csrf,
        json={
            "email": email,
            "password": "secret1234",
            "first_name": "Test",
            "last_name": "User",
        },
    )
    assert r.status_code == 201

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
    assert r.status_code == 200

    return c


# ── GET /users/me ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_profile_authenticated(http_client: AsyncClient) -> None:
    """Authenticated GET /users/me returns the user profile."""
    await _register_and_login(http_client)

    r = await http_client.get("/api/v1/users/me")
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "user-test@test.local"
    assert data["first_name"] == "Test"
    assert data["last_name"] == "User"
    assert data["locale"] == "en"
    assert data["theme"] == "system"
    assert data["timezone"] == "UTC"


@pytest.mark.asyncio
async def test_get_profile_unauthenticated(http_client: AsyncClient) -> None:
    """Unauthenticated GET /users/me returns 401."""
    r = await http_client.get("/api/v1/users/me")
    assert r.status_code == 401


# ── PATCH /users/me — partial update ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_profile_partial(http_client: AsyncClient) -> None:
    """PATCH with subset of fields only updates those fields."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_patch(
        http_client,
        "/api/v1/users/me",
        csrf,
        json={"first_name": "Updated"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["first_name"] == "Updated"
    # Other fields unchanged
    assert data["last_name"] == "User"
    assert data["theme"] == "system"


@pytest.mark.asyncio
async def test_patch_profile_all_fields(http_client: AsyncClient) -> None:
    """PATCH with all fields updates everything."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_patch(
        http_client,
        "/api/v1/users/me",
        csrf,
        json={
            "first_name": "NewFirst",
            "last_name": "NewLast",
            "theme": "dark",
            "locale": "fr",
            "timezone": "Europe/Paris",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["first_name"] == "NewFirst"
    assert data["last_name"] == "NewLast"
    assert data["theme"] == "dark"
    assert data["locale"] == "fr"
    assert data["timezone"] == "Europe/Paris"


@pytest.mark.asyncio
async def test_patch_profile_empty_body(http_client: AsyncClient) -> None:
    """PATCH with empty body returns current profile unchanged."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_patch(
        http_client,
        "/api/v1/users/me",
        csrf,
        json={},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "user-test@test.local"


# ── PATCH /users/me — validation ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_invalid_theme(http_client: AsyncClient) -> None:
    """PATCH with invalid theme returns 422."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_patch(
        http_client,
        "/api/v1/users/me",
        csrf,
        json={"theme": "invalid"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_patch_invalid_locale(http_client: AsyncClient) -> None:
    """PATCH with invalid locale returns 422."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_patch(
        http_client,
        "/api/v1/users/me",
        csrf,
        json={"locale": "de"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_patch_invalid_timezone(http_client: AsyncClient) -> None:
    """PATCH with invalid timezone returns 422."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_patch(
        http_client,
        "/api/v1/users/me",
        csrf,
        json={"timezone": "not/a/timezone!"},
    )
    assert r.status_code == 422


# ── PATCH /users/me — authentication ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_profile_unauthenticated(http_client: AsyncClient) -> None:
    """Unauthenticated PATCH /users/me returns 401."""
    csrf = await _fetch_csrf(http_client)
    r = await _csrf_patch(
        http_client,
        "/api/v1/users/me",
        csrf,
        json={"first_name": "X"},
    )
    assert r.status_code == 401


# ── GET /users/me/notification-prefs ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_prefs_empty(http_client: AsyncClient) -> None:
    """GET notification-prefs returns empty list for new user."""
    await _register_and_login(http_client)

    r = await http_client.get("/api/v1/users/me/notification-prefs")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_list_prefs_unauthenticated(http_client: AsyncClient) -> None:
    """Unauthenticated GET notification-prefs returns 401."""
    r = await http_client.get("/api/v1/users/me/notification-prefs")
    assert r.status_code == 401


# ── PUT /users/me/notification-prefs — upsert ────────────────────────────────


@pytest.mark.asyncio
async def test_upsert_pref_create(http_client: AsyncClient) -> None:
    """PUT creates a new notification preference."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_put(
        http_client,
        "/api/v1/users/me/notification-prefs",
        csrf,
        json={
            "module_key": "halo",
            "event_type": "comment_added",
            "channel": "in_app",
            "enabled": True,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["module_key"] == "halo"
    assert data["event_type"] == "comment_added"
    assert data["channel"] == "in_app"
    assert data["enabled"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_upsert_pref_update_existing(http_client: AsyncClient) -> None:
    """PUT on an existing (module_key, event_type, channel) updates enabled."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    body = {
        "module_key": "halo",
        "event_type": "mention",
        "channel": "email",
        "enabled": True,
    }

    # First PUT — create
    r1 = await _csrf_put(
        http_client,
        "/api/v1/users/me/notification-prefs",
        csrf,
        json=body,
    )
    assert r1.status_code == 200
    assert r1.json()["enabled"] is True
    id1 = r1.json()["id"]

    # Second PUT — update (same unique key)
    body["enabled"] = False
    r2 = await _csrf_put(
        http_client,
        "/api/v1/users/me/notification-prefs",
        csrf,
        json=body,
    )
    assert r2.status_code == 200
    assert r2.json()["enabled"] is False
    assert r2.json()["id"] == id1  # Same record

    # Verify list reflects the update
    r_list = await http_client.get("/api/v1/users/me/notification-prefs")
    assert r_list.status_code == 200
    prefs = r_list.json()
    assert len(prefs) == 1
    assert prefs[0]["enabled"] is False


@pytest.mark.asyncio
async def test_upsert_pref_idempotent(http_client: AsyncClient) -> None:
    """PUT with same params twice is idempotent."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    body = {
        "module_key": "halo",
        "event_type": "task_assigned",
        "channel": "in_app",
        "enabled": True,
    }

    r1 = await _csrf_put(
        http_client, "/api/v1/users/me/notification-prefs", csrf, json=body
    )
    r2 = await _csrf_put(
        http_client, "/api/v1/users/me/notification-prefs", csrf, json=body
    )
    assert r1.status_code == r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]
    assert r1.json()["enabled"] == r2.json()["enabled"]


@pytest.mark.asyncio
async def test_upsert_pref_multiple_channels(http_client: AsyncClient) -> None:
    """Different channels for the same event create separate prefs."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    # Create in_app pref
    r1 = await _csrf_put(
        http_client,
        "/api/v1/users/me/notification-prefs",
        csrf,
        json={
            "module_key": "halo",
            "event_type": "comment_added",
            "channel": "in_app",
            "enabled": True,
        },
    )
    assert r1.status_code == 200

    # Create email pref for same event
    r2 = await _csrf_put(
        http_client,
        "/api/v1/users/me/notification-prefs",
        csrf,
        json={
            "module_key": "halo",
            "event_type": "comment_added",
            "channel": "email",
            "enabled": False,
        },
    )
    assert r2.status_code == 200
    assert r2.json()["id"] != r1.json()["id"]

    # List shows both
    r_list = await http_client.get("/api/v1/users/me/notification-prefs")
    assert len(r_list.json()) == 2


@pytest.mark.asyncio
async def test_upsert_pref_unauthenticated(http_client: AsyncClient) -> None:
    """Unauthenticated PUT notification-prefs returns 401."""
    csrf = await _fetch_csrf(http_client)
    r = await _csrf_put(
        http_client,
        "/api/v1/users/me/notification-prefs",
        csrf,
        json={
            "module_key": "halo",
            "event_type": "comment_added",
            "channel": "in_app",
            "enabled": True,
        },
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_upsert_pref_invalid_channel(http_client: AsyncClient) -> None:
    """PUT with invalid channel returns 422."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_put(
        http_client,
        "/api/v1/users/me/notification-prefs",
        csrf,
        json={
            "module_key": "halo",
            "event_type": "comment_added",
            "channel": "sms",
            "enabled": True,
        },
    )
    assert r.status_code == 422


# ── CSRF protection on mutating users endpoints ──────────────────────────────


@pytest.mark.asyncio
async def test_csrf_blocks_patch_without_header(http_client: AsyncClient) -> None:
    """PATCH /users/me without CSRF header → 403."""
    await _register_and_login(http_client)
    r = await http_client.patch(
        "/api/v1/users/me",
        json={"first_name": "X"},
    )
    assert r.status_code == 403
    assert r.json()["code"] == "CSRF_INVALID"


@pytest.mark.asyncio
async def test_csrf_blocks_put_prefs_without_header(
    http_client: AsyncClient,
) -> None:
    """PUT /users/me/notification-prefs without CSRF header → 403."""
    await _register_and_login(http_client)
    r = await http_client.put(
        "/api/v1/users/me/notification-prefs",
        json={
            "module_key": "halo",
            "event_type": "x",
            "channel": "in_app",
            "enabled": True,
        },
    )
    assert r.status_code == 403
    assert r.json()["code"] == "CSRF_INVALID"
