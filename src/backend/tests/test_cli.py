"""CLI admin tests — T-075, F-095b.

Tests the ORM-level logic used by ``create-admin`` and ``promote-admin``.
The CLI entry points are thin wrappers around these functions.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from halo_api.accounts.models import User
from halo_api.accounts.security import hash_password
from tests.conftest import cleanup_db_file, run_alembic


@pytest.mark.asyncio
async def test_create_admin_user_orm(db_url: str) -> None:
    """An admin user created via ORM has is_admin=True, is_verified=True."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        user = User(
            email="cli-admin@test.local",
            password_hash=hash_password("adminpass123"),
            first_name="Super",
            last_name="Admin",
            is_admin=True,
            is_verified=True,
        )
        s.add(user)
        await s.commit()
        admin_id = user.id

    async with sf() as s:
        result = await s.execute(select(User).where(User.id == admin_id))
        u = result.scalar_one()
        assert u.is_admin is True
        assert u.is_verified is True
        assert u.email == "cli-admin@test.local"

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_promote_admin_orm(db_url: str) -> None:
    """Promoting a user sets is_admin=True."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with sf() as s:
        user = User(
            email="promote-me@test.local",
            password_hash=hash_password("regular123"),
            first_name="Regular",
            last_name="User",
            is_admin=False,
            is_verified=True,
        )
        s.add(user)
        await s.commit()
        user_id = user.id

    # Simulate promote_admin logic
    async with sf() as s:
        result = await s.execute(select(User).where(User.id == user_id))
        u = result.scalar_one()
        u.is_admin = True
        await s.commit()

    # Verify
    async with sf() as s:
        result = await s.execute(select(User).where(User.id == user_id))
        u = result.scalar_one()
        assert u.is_admin is True

    await engine.dispose()
    cleanup_db_file(db_url)
