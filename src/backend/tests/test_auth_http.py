"""HTTP integration tests for auth endpoints — dual-engine (T-172).

Every test uses the ``http_client`` fixture parametrised across SQLite and
PostgreSQL.  The FastAPI app is hit via ``ASGITransport``.  CSRF protection
is active — all mutating requests send both the cookie and the header.
"""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from halo_api.accounts.models import EmailToken, User
from halo_api.accounts.security import generate_token, hash_password

# ── Helpers ──────────────────────────────────────────────────────────────────


async def _fetch_csrf(c: AsyncClient) -> str:
    """GET /auth/csrf and return the token value.

    The ``csrf_token`` cookie is set by the server via ``Set-Cookie`` and
    httpx stores it automatically in the client's cookie jar.  We just
    return the token so it can be used as an ``X-CSRF-Token`` header.
    """
    r = await c.get("/api/v1/auth/csrf")
    assert r.status_code == 200
    token: str = r.json()["token"]
    return token


def _csrf_post(  # type: ignore[no-untyped-def]
    c: AsyncClient, path: str, csrf: str = "", **kw
):
    """POST *path* with the CSRF header (cookie is sent from client jar)."""
    token = csrf or _csrf_from_client(c)
    return c.post(
        path,
        headers={"X-CSRF-Token": token, "Content-Type": "application/json"},
        **kw,
    )


def _csrf_from_client(c: AsyncClient) -> str:
    """Read the csrf_token from the client's cookie jar."""
    return c.cookies.get("csrf_token", "") or ""


# ── Anti-enumeration: register (T-083, T-172) ───────────────────────────────


@pytest.mark.asyncio
async def test_anti_enumeration_register(http_client: AsyncClient) -> None:
    """Register returns identical 201 + body for new and existing emails."""
    csrf = await _fetch_csrf(http_client)

    body_new = {
        "email": "ae-reg@test.local",
        "password": "secret1234",
        "first_name": "New",
        "last_name": "User",
    }
    body_existing = {
        "email": "ae-reg@test.local",
        "password": "secret1234",
        "first_name": "X",
        "last_name": "Y",
    }

    r1 = await _csrf_post(http_client, "/api/v1/auth/register", csrf, json=body_new)
    r2 = await _csrf_post(
        http_client, "/api/v1/auth/register", csrf, json=body_existing
    )

    assert r1.status_code == r2.status_code == 201
    assert r1.json() == r2.json()


# ── Anti-enumeration: login (T-083, T-172) ──────────────────────────────────


@pytest.mark.asyncio
async def test_anti_enumeration_login(http_client: AsyncClient) -> None:
    """Login returns identical 401 for unknown email and wrong password."""
    csrf = await _fetch_csrf(http_client)

    # Create a user first so "wrong password" scenario is meaningful.
    await _csrf_post(
        http_client,
        "/api/v1/auth/register",
        csrf,
        json={
            "email": "ae-login@test.local",
            "password": "correctpw",
            "first_name": "A",
            "last_name": "B",
        },
    )

    r_unknown = await _csrf_post(
        http_client,
        "/api/v1/auth/login",
        csrf,
        json={
            "email": "ghost@test.local",
            "password": "anything",
        },
    )
    r_wrong = await _csrf_post(
        http_client,
        "/api/v1/auth/login",
        csrf,
        json={
            "email": "ae-login@test.local",
            "password": "wrongpassword",
        },
    )

    assert r_unknown.status_code == r_wrong.status_code == 401
    assert r_unknown.json() == r_wrong.json()


# ── Anti-enumeration: forgot-password (T-083, T-172) ────────────────────────


@pytest.mark.asyncio
async def test_anti_enumeration_forgot_password(http_client: AsyncClient) -> None:
    """Forgot-password returns identical 200 for known and unknown emails."""
    csrf = await _fetch_csrf(http_client)

    await _csrf_post(
        http_client,
        "/api/v1/auth/register",
        csrf,
        json={
            "email": "ae-fp@test.local",
            "password": "secret1234",
            "first_name": "F",
            "last_name": "P",
        },
    )

    r_known = await _csrf_post(
        http_client,
        "/api/v1/auth/forgot-password",
        csrf,
        json={"email": "ae-fp@test.local"},
    )
    r_unknown = await _csrf_post(
        http_client,
        "/api/v1/auth/forgot-password",
        csrf,
        json={"email": "no-one@test.local"},
    )

    assert r_known.status_code == r_unknown.status_code == 200
    assert r_known.json() == r_unknown.json()


# ── CSRF protection (T-071) ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_csrf_blocks_post_without_cookie(http_client: AsyncClient) -> None:
    """POST without csrf_token cookie AND header → 403."""
    r = await http_client.post(
        "/api/v1/auth/login",
        json={
            "email": "x@t.l",
            "password": "12345678",
        },
    )
    assert r.status_code == 403
    assert r.json()["code"] == "CSRF_INVALID"


@pytest.mark.asyncio
async def test_csrf_allows_post_with_matching_pair(http_client: AsyncClient) -> None:
    """POST with csrf_token cookie == X-CSRF-Token header → passes through."""
    csrf = await _fetch_csrf(http_client)
    r = await _csrf_post(
        http_client,
        "/api/v1/auth/register",
        csrf,
        json={
            "email": "csrf-ok@test.local",
            "password": "pass12345",
            "first_name": "Csrf",
            "last_name": "Ok",
        },
    )
    # 201 = registration succeeded (CSRF check passed)
    assert r.status_code == 201


# ── Full auth flow ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_full_auth_flow(http_client: AsyncClient) -> None:
    """Register → verify → login → me (authenticated) → logout → me (anon)."""
    csrf = await _fetch_csrf(http_client)

    # 1. Register
    r = await _csrf_post(
        http_client,
        "/api/v1/auth/register",
        csrf,
        json={
            "email": "flow@test.local",
            "password": "flowpw12",
            "first_name": "Flow",
            "last_name": "Test",
        },
    )
    assert r.status_code == 201

    # 2. Fetch the verify token from the DB and verify the user directly.
    from halo_api.core import db as db_mod

    engine = db_mod.engine
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sf() as s:
        result = await s.execute(
            select(EmailToken).where(EmailToken.purpose == "verify")
        )
        et = result.scalars().first()
        assert et is not None
        et.used_at = datetime.now(UTC)
        user_result = await s.execute(
            select(User).where(User.email == "flow@test.local")
        )
        user = user_result.scalar_one()
        user.is_verified = True
        await s.commit()

    # 3. Login
    r = await _csrf_post(
        http_client,
        "/api/v1/auth/login",
        csrf,
        json={
            "email": "flow@test.local",
            "password": "flowpw12",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "flow@test.local"

    # Check cookie attributes
    set_cookie = r.headers.get("set-cookie", "")
    assert "halo_session=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "samesite=lax" in set_cookie.lower()

    # Cookies set by the login response are stored in the client's cookie jar.
    # httpx AsyncClient persists cookies across requests automatically.
    # 4. GET /me (authenticated — cookie sent automatically)
    r = await http_client.get("/api/v1/auth/me")
    assert r.status_code == 200
    me_data = r.json()
    assert me_data["authenticated"] is True, f"Expected authenticated, got {me_data}"
    assert me_data["user"]["email"] == "flow@test.local"

    # 5. Logout — login emitted a fresh csrf_token; read the updated one.
    csrf2 = _csrf_from_client(http_client)
    r = await _csrf_post(http_client, "/api/v1/auth/logout", csrf2)
    assert r.status_code == 200

    # 6. GET /me (session invalidated → anonymous)
    r = await http_client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["authenticated"] is False


# ── Password reset ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reset_token_single_use(http_client: AsyncClient) -> None:
    """Reset token can only be used once (T-082)."""
    csrf = await _fetch_csrf(http_client)

    # Create verified user + reset token directly in DB.
    from halo_api.core import db as db_mod

    engine = db_mod.engine
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    cleartext, token_hash_val = generate_token()
    async with sf() as s:
        user = User(
            email="once@test.local",
            password_hash=hash_password("old"),
            first_name="O",
            last_name="N",
            is_verified=True,
        )
        s.add(user)
        await s.flush()
        s.add(
            EmailToken(
                user_id=user.id,
                purpose="reset",
                token_hash=token_hash_val,
                expires_at=datetime.now(UTC) + timedelta(minutes=60),
            )
        )
        await s.commit()

    # First use — success
    r1 = await _csrf_post(
        http_client,
        "/api/v1/auth/reset-password",
        csrf,
        json={"token": cleartext, "password": "first-new-pw"},
    )
    assert r1.status_code == 200
    assert "success" in r1.json()["message"].lower()

    # Second use — rejected
    r2 = await _csrf_post(
        http_client,
        "/api/v1/auth/reset-password",
        csrf,
        json={"token": cleartext, "password": "second-new-pw"},
    )
    assert r2.status_code == 200
    assert "invalid" in r2.json()["message"].lower()


@pytest.mark.asyncio
async def test_reset_token_expired(http_client: AsyncClient) -> None:
    """Expired reset token is rejected."""
    csrf = await _fetch_csrf(http_client)

    from halo_api.core import db as db_mod

    engine = db_mod.engine
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    cleartext, token_hash_val = generate_token()
    async with sf() as s:
        user = User(
            email="exp-rst@test.local",
            password_hash=hash_password("old"),
            first_name="E",
            last_name="R",
            is_verified=True,
        )
        s.add(user)
        await s.flush()
        s.add(
            EmailToken(
                user_id=user.id,
                purpose="reset",
                token_hash=token_hash_val,
                expires_at=datetime.now(UTC) - timedelta(minutes=1),
            )
        )
        await s.commit()

    r = await _csrf_post(
        http_client,
        "/api/v1/auth/reset-password",
        csrf,
        json={"token": cleartext, "password": "newpw123"},
    )
    assert r.status_code == 200
    assert "invalid" in r.json()["message"].lower()
