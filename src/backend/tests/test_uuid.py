"""UUIDv7 convention and Module model tests (step 1b-bis).

Covers:
- ``uuid.uuid7()`` temporal ordering (indexability sanity).
- ``Module.enabled_by`` UUID round-trip on both SQLite and PostgreSQL.
"""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from halo_api.modules.models import Module
from tests.conftest import cleanup_db_file, run_alembic

# ── uuid.uuid7() ordering ─────────────────────────────────────────────────────


def test_uuid7_ordering() -> None:
    """Two successive UUIDv7 values must sort in creation order.

    UUIDv7 embeds a millisecond-precision timestamp followed by random bits.
    The lexicographic (and numeric) ordering of two UUIDs generated in the
    same process must reflect the order of generation — this is the property
    that makes UUIDv7 B-tree-friendly.
    """
    a = uuid.uuid7()
    b = uuid.uuid7()
    assert a < b, (
        f"UUIDv7 ordering violated: {a!s} >= {b!s} — "
        "successive uuid.uuid7() calls must be monotonically increasing"
    )


# ── Module.enabled_by round-trip ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_module_enabled_by_uuid_roundtrip(db_url: str) -> None:
    """``Module.enabled_by`` stores and retrieves a ``uuid.UUID`` correctly.

    Verifies that the portable ``sa.Uuid()`` column type works identically on
    SQLite (CHAR(32)) and PostgreSQL (native uuid).
    """
    cleanup_db_file(db_url)

    # -- apply the migration ----------------------------------------------------
    proc = run_alembic(["upgrade", "head"], db_url)
    assert proc.returncode == 0, f"Migration failed: {proc.stderr}"

    # -- create a fresh engine + session for this test ---------------------------
    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    admin_id = uuid.uuid7()

    async with session_factory() as session:
        # -- insert -------------------------------------------------------------
        mod = Module(key="test_uuid_roundtrip", enabled=True, enabled_by=admin_id)
        session.add(mod)
        await session.commit()

    async with session_factory() as session:
        # -- read back ----------------------------------------------------------
        stmt = select(Module).where(Module.key == "test_uuid_roundtrip")
        result = await session.execute(stmt)
        row = result.scalar_one()
        assert row.enabled_by == admin_id, (
            f"Round-trip mismatch: stored={admin_id!s}, "
            f"read={row.enabled_by!s} on {db_url}"
        )

    # -- cleanup ----------------------------------------------------------------
    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_module_enabled_by_null_is_preserved(db_url: str) -> None:
    """``enabled_by`` stays ``None`` when not set (nullable behaviour)."""
    cleanup_db_file(db_url)

    proc = run_alembic(["upgrade", "head"], db_url)
    assert proc.returncode == 0, f"Migration failed: {proc.stderr}"

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with session_factory() as session:
        mod = Module(key="test_null_enabled_by", enabled=False, enabled_by=None)
        session.add(mod)
        await session.commit()

    async with session_factory() as session:
        stmt = select(Module).where(Module.key == "test_null_enabled_by")
        result = await session.execute(stmt)
        row = result.scalar_one()
        assert row.enabled_by is None, (
            f"Expected enabled_by=None, got {row.enabled_by!r} on {db_url}"
        )

    await engine.dispose()
    cleanup_db_file(db_url)
