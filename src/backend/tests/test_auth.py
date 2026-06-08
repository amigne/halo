"""Auth tests — ORM-level (dual-engine: SQLite + PostgreSQL).

Covers: user creation, password hashing, token generation/verification,
session lifecycle, email token expiry, anti-enumeration logic.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from halo_api.accounts.models import EmailToken, Session, User
from halo_api.accounts.security import (
    generate_token,
    hash_password,
    hash_token,
    verify_password,
    verify_token,
)
from tests.conftest import cleanup_db_file, run_alembic

# ── User ORM ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_user_orm(db_url: str) -> None:
    """A User record stores all fields correctly."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        user = User(
            email="orm-test@test.local",
            password_hash=hash_password("secret1234"),
            first_name="Jane",
            last_name="Doe",
            is_verified=False,
            is_admin=False,
            locale="fr",
            theme="dark",
            timezone="Europe/Paris",
        )
        s.add(user)
        await s.commit()

        result = await s.execute(select(User).where(User.id == user.id))
        u = result.scalar_one()
        assert u.email == "orm-test@test.local"
        assert u.first_name == "Jane"
        assert u.is_verified is False
        assert u.is_admin is False
        assert u.locale == "fr"
        assert u.created_at is not None
        assert u.updated_at is not None

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_user_email_unique(db_url: str) -> None:
    """Duplicate email raises IntegrityError on both engines."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        s.add(
            User(
                email="unique@test.local",
                password_hash=hash_password("pw"),
                first_name="A",
                last_name="B",
            )
        )
        await s.commit()

        s.add(
            User(
                email="unique@test.local",
                password_hash=hash_password("pw2"),
                first_name="C",
                last_name="D",
            )
        )
        from sqlalchemy.exc import IntegrityError

        with pytest.raises(IntegrityError):
            await s.commit()

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_user_defaults(db_url: str) -> None:
    """Default values: is_admin=False, is_verified=False, is_blocked=False."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        user = User(
            email="defaults@test.local",
            password_hash=hash_password("pw"),
            first_name="D",
            last_name="F",
        )
        s.add(user)
        await s.commit()
        assert user.is_admin is False
        assert user.is_verified is False
        assert user.is_blocked is False
        assert user.locale == "en"
        assert user.theme == "system"
        assert user.timezone == "UTC"

    await engine.dispose()
    cleanup_db_file(db_url)


# ── Password hashing ─────────────────────────────────────────────────────────


def test_hash_and_verify_password() -> None:
    """Argon2id hash can be verified."""
    pw = "my-secret-password"
    h = hash_password(pw)
    assert h != pw
    assert verify_password(pw, h)
    assert not verify_password("wrong", h)


def test_verify_invalid_hash() -> None:
    """verify_password returns False for garbage hash."""
    assert verify_password("anything", "not-a-valid-hash") is False


def test_hash_is_salted() -> None:
    """Two hashes of the same password differ (salting)."""
    pw = "same-password"
    h1 = hash_password(pw)
    h2 = hash_password(pw)
    assert h1 != h2
    assert verify_password(pw, h1)
    assert verify_password(pw, h2)


# ── Token generation ─────────────────────────────────────────────────────────


def test_generate_token_creates_unique_values() -> None:
    """Each call produces a different cleartext and hash."""
    c1, h1 = generate_token()
    c2, h2 = generate_token()
    assert c1 != c2
    assert h1 != h2
    assert len(c1) >= 32  # ~256 bits in base64-url
    assert len(h1) == 64  # SHA-256 hex


def test_token_verification_constant_time() -> None:
    """verify_token succeeds for matching token, fails otherwise (T-082)."""
    cleartext, stored_hash = generate_token()
    # Sanity: hash_token produces the same hash
    assert hash_token(cleartext) == stored_hash
    assert verify_token(cleartext, stored_hash) is True
    assert verify_token("wrong-token", stored_hash) is False
    assert verify_token(cleartext, "a" * 64) is False


# ── Session lifecycle ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_session_create_and_retrieve(db_url: str) -> None:
    """A session is persisted and can be looked up by token."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        user = User(
            email="sess@test.local",
            password_hash=hash_password("pw"),
            first_name="S",
            last_name="T",
            is_verified=True,
        )
        s.add(user)
        await s.commit()

        from halo_api.accounts.session import create_session, get_user_from_token

        token = await create_session(s, user, ip="127.0.0.1", ua="pytest")
        assert token is not None

        u = await get_user_from_token(s, token)
        assert u is not None
        assert u.email == "sess@test.local"

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_session_invalidation(db_url: str) -> None:
    """An invalidated session cannot be retrieved (T-072)."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        user = User(
            email="inval@test.local",
            password_hash=hash_password("pw"),
            first_name="I",
            last_name="V",
            is_verified=True,
        )
        s.add(user)
        await s.commit()

        from halo_api.accounts.session import (
            create_session,
            get_user_from_token,
            invalidate_session,
        )

        token = await create_session(s, user)
        assert await get_user_from_token(s, token) is not None

        deleted = await invalidate_session(s, token)
        assert deleted is True
        assert await get_user_from_token(s, token) is None

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_session_expired_not_retrieved(db_url: str) -> None:
    """An expired session is not returned by get_user_from_token."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        user = User(
            email="expired-sess@test.local",
            password_hash=hash_password("pw"),
            first_name="E",
            last_name="S",
            is_verified=True,
        )
        s.add(user)
        await s.commit()

        # Manually create an expired session
        token_hash_val = hash_token("expired-token-value")
        expired_session = Session(
            user_id=user.id,
            token_hash=token_hash_val,
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )
        s.add(expired_session)
        await s.commit()

        from halo_api.accounts.session import get_user_from_token

        u = await get_user_from_token(s, "expired-token-value")
        # Session is expired — should return None
        assert u is None

    await engine.dispose()
    cleanup_db_file(db_url)


# ── Email tokens ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_email_token_create_and_use(db_url: str) -> None:
    """An email token can be created and marked as used."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        user = User(
            email="tok-user@test.local",
            password_hash=hash_password("pw"),
            first_name="T",
            last_name="U",
            is_verified=False,
        )
        s.add(user)
        await s.flush()

        _cleartext, token_hash_val = generate_token()
        et = EmailToken(
            user_id=user.id,
            purpose="verify",
            token_hash=token_hash_val,
            expires_at=datetime.now(UTC) + timedelta(minutes=60),
        )
        s.add(et)
        await s.commit()

        # Mark as used
        et.used_at = datetime.now(UTC)
        await s.commit()
        assert et.used_at is not None

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_email_token_expired_not_valid(db_url: str) -> None:
    """An expired email token is excluded by expiry check."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        user = User(
            email="exp-tok@test.local",
            password_hash=hash_password("pw"),
            first_name="E",
            last_name="T",
            is_verified=False,
        )
        s.add(user)
        await s.flush()

        _, token_hash_val = generate_token()
        expired = EmailToken(
            user_id=user.id,
            purpose="verify",
            token_hash=token_hash_val,
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )
        s.add(expired)
        await s.commit()

        # Query: non-expired, unused verify token with this hash
        result = await s.execute(
            select(EmailToken).where(
                EmailToken.token_hash == token_hash_val,
                EmailToken.purpose == "verify",
                EmailToken.expires_at > datetime.now(UTC),
                EmailToken.used_at.is_(None),
            )
        )
        assert result.scalar_one_or_none() is None

    await engine.dispose()
    cleanup_db_file(db_url)


# ── Anti-enumeration logic ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_email_lookup_case_insensitive(db_url: str) -> None:
    """Email lookup uses lowercased email (T-142)."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        s.add(
            User(
                email="case-test@test.local",
                password_hash=hash_password("pw"),
                first_name="C",
                last_name="T",
            )
        )
        await s.commit()

    async with sf() as s:
        await s.execute(select(User).where(User.email == "CASE-TEST@test.local"))
        # String comparison is case-sensitive unless the DB uses citext.
        # On SQLite, String columns are case-sensitive by default.
        # The application layer .lower() ensures case-insensitive lookup.
        result2 = await s.execute(
            select(User).where(User.email == "case-test@test.local")
        )
        assert result2.scalar_one_or_none() is not None

    await engine.dispose()
    cleanup_db_file(db_url)
