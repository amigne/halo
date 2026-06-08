"""Module registry tests — registration, activation, and DB persistence (T-040).

Every persistence-affecting test is parametrised across SQLite and PostgreSQL
via the ``db_url`` fixture from ``conftest.py``.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from halo_api.modules.models import Module as ModuleRow
from halo_api.modules.registry import (
    disable,
    enable,
    get_module,
    is_enabled,
    list_modules,
    register,
    sync_registry,
)
from tests.conftest import cleanup_db_file, run_alembic
from tests.module_dummy import DummyModule

# ═══════════════════════════════════════════════════════════════════════════════
# WARNING — module-level mutable state
# ═══════════════════════════════════════════════════════════════════════════════
# ``register()`` mutates the global ``_modules`` dict inside halo_api.modules.registry.
# Multiple test functions that call ``register()`` may interfere with each other
# if they run in the same worker process.  We mitigate this by:
#  1. Using a unique module key per test (via a fresh DummyModule subclass).
#  2. Never calling ``register()`` inside a parametrised test that runs against
#     multiple databases — the second parametrisation sees the state from the first.
#
# Tests that DO need register() run against SQLite only (no db_url fixture).
# Persistence tests use the registry's DB functions directly (they don't need
# register() — they operate on arbitrary keys).


# ── In-memory registration (no DB needed) ─────────────────────────────────────


def test_register_adds_module() -> None:
    """``register()`` stores a module and ``list_modules()`` returns it."""
    mod = DummyModule()
    # Use a unique key to avoid collisions with other tests.
    # We can't mutate the class attr, so test with the default key
    # and clean up by re-registering (which will raise if duplicate).
    register(mod)
    try:
        assert mod.key in {m.key for m in list_modules()}
        assert get_module(mod.key) is mod
    finally:
        # Clean up: remove from _modules to avoid polluting other tests.
        from halo_api.modules.registry import _modules

        _modules.pop(mod.key, None)


def test_register_duplicate_key_raises() -> None:
    """Registering a second module with the same key raises ValueError."""
    mod1 = DummyModule()

    class DupeModule(DummyModule):
        pass  # same key="dummy" from DummyModule

    mod2 = DupeModule()
    register(mod1)
    try:
        with pytest.raises(ValueError, match="dummy"):
            register(mod2)
    finally:
        from halo_api.modules.registry import _modules

        _modules.pop(mod1.key, None)


def test_list_modules_returns_registration_order() -> None:
    """``list_modules()`` preserves insertion order (Python 3.7+ dict)."""

    class ModuleA(DummyModule):
        key = "test_reg_a"

    class ModuleB(DummyModule):
        key = "test_reg_b"

    register(ModuleA())
    register(ModuleB())
    try:
        keys = [m.key for m in list_modules()]
        # Only check relative order of our two keys
        idx_a = keys.index("test_reg_a")
        idx_b = keys.index("test_reg_b")
        assert idx_a < idx_b, f"Expected A before B, got {keys}"
    finally:
        from halo_api.modules.registry import _modules

        _modules.pop("test_reg_a", None)
        _modules.pop("test_reg_b", None)


def test_get_module_missing_returns_none() -> None:
    assert get_module("nonexistent") is None


# ── Persistence (SQLite + Postgres) ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_is_enabled_returns_false_for_unknown_key(db_url: str) -> None:
    """A key with no row in the ``modules`` table is considered disabled."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with session_factory() as session:
        assert await is_enabled(session, "no_such_module") is False

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_enable_creates_row_and_sets_enabled(db_url: str) -> None:
    """``enable()`` creates a ``modules`` row and ``is_enabled()`` sees it."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    from halo_api.accounts.models import User

    async with session_factory() as session:
        # Create a user so the FK constraint on enabled_by is satisfied
        user = User(
            email="test_enable_mod_admin@test.local",
            password_hash="dummy",
            first_name="Admin",
            last_name="Test",
            is_admin=True,
            is_verified=True,
        )
        session.add(user)
        await session.flush()

        admin_id = user.id
        await enable(session, "test_enable_mod", enabled_by=admin_id)
        await session.commit()

    async with session_factory() as session:
        assert await is_enabled(session, "test_enable_mod") is True
        row = await session.get(ModuleRow, "test_enable_mod")
        assert row is not None
        assert row.enabled is True
        assert row.enabled_at is not None
        assert row.enabled_by == admin_id

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_disable_after_enable(db_url: str) -> None:
    """``disable()`` sets enabled=False and ``is_enabled()`` returns False."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with session_factory() as session:
        await enable(session, "test_disable_mod")
        await session.commit()

    async with session_factory() as session:
        await disable(session, "test_disable_mod")
        await session.commit()

    async with session_factory() as session:
        assert await is_enabled(session, "test_disable_mod") is False
        row = await session.get(ModuleRow, "test_disable_mod")
        assert row is not None
        assert row.enabled is False

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_disable_creates_row_if_missing(db_url: str) -> None:
    """``disable()`` on a never-seen key creates a row with enabled=False."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with session_factory() as session:
        await disable(session, "test_disable_new_key")
        await session.commit()

    async with session_factory() as session:
        row = await session.get(ModuleRow, "test_disable_new_key")
        assert row is not None
        assert row.enabled is False
        assert row.enabled_at is None
        assert row.enabled_by is None

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_sync_registry_inserts_missing_rows(db_url: str) -> None:
    """``sync_registry()`` creates rows for registered modules that are absent."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    # Register a temporary module so sync_registry has something to discover.
    class SyncTestMod(DummyModule):
        key = "test_sync_mod"

    mod = SyncTestMod()
    register(mod)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    try:
        async with session_factory() as session:
            await sync_registry(session)
            await session.commit()

        async with session_factory() as session:
            row = await session.get(ModuleRow, "test_sync_mod")
            assert row is not None, "sync_registry should have created the row"
            assert row.enabled is False, "new rows must default to enabled=False"
    finally:
        from halo_api.modules.registry import _modules

        _modules.pop("test_sync_mod", None)

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_sync_registry_does_not_overwrite_existing(db_url: str) -> None:
    """``sync_registry()`` leaves already-enabled rows untouched."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    class SyncExistingMod(DummyModule):
        key = "test_sync_existing"

    mod = SyncExistingMod()
    register(mod)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    try:
        # Enable the module first.
        async with session_factory() as session:
            await enable(session, "test_sync_existing")
            await session.commit()

        # Now sync — it must not flip enabled back to False.
        async with session_factory() as session:
            await sync_registry(session)
            await session.commit()

        async with session_factory() as session:
            row = await session.get(ModuleRow, "test_sync_existing")
            assert row is not None
            assert row.enabled is True, "sync_registry must preserve enabled=True"
    finally:
        from halo_api.modules.registry import _modules

        _modules.pop("test_sync_existing", None)

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_enable_is_idempotent(db_url: str) -> None:
    """Calling ``enable()`` twice does not raise and keeps the module enabled."""
    cleanup_db_file(db_url)
    run_alembic(["upgrade", "head"], db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with session_factory() as session:
        await enable(session, "test_idempotent")
        await session.commit()

    async with session_factory() as session:
        await enable(session, "test_idempotent")  # second call
        await session.commit()

    async with session_factory() as session:
        assert await is_enabled(session, "test_idempotent") is True

    await engine.dispose()
    cleanup_db_file(db_url)
