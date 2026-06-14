"""Tests for ListsModule — contract, resolve_refs, search_titles (step 4-5).

Covers:
- Module registered in registry, activated by default
- resolve_refs: known ref_no → correct RefHit; unknown/cross-user → absent
- search_titles: case-insensitive; cross-user isolation
- Outside request context: no user/session → empty results, no exception

Persistence tests are parametrised across SQLite and PostgreSQL via the
``db_url`` fixture from ``conftest.py``.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from halo_api.accounts.models import User
from halo_api.core.context import current_session_cv, current_user_cv
from halo_api.modules.base import RefHit, RefType
from halo_api.modules.lists.models import List
from halo_api.modules.registry import get_module
from tests.conftest import cleanup_db_file, run_alembic

# ═══════════════════════════════════════════════════════════════════════════════
# NOTE — module-level registration
# ═══════════════════════════════════════════════════════════════════════════════
# ``halo_api.modules.lists`` calls ``register(ListsModule())`` at import time.
# This is intentional — the module is always registered when the app starts.
# Tests that need the class without side effects import directly from
# ``halo_api.modules.lists.module``.


# ── Helpers ──────────────────────────────────────────────────────────────────


def _prepare_db(db_url: str) -> None:
    """Reset the database and apply all migrations."""
    cleanup_db_file(db_url)
    run_alembic(["downgrade", "base"], db_url)
    proc = run_alembic(["upgrade", "head"], db_url)
    assert proc.returncode == 0, f"Migration failed for {db_url}:\n{proc.stderr}"


def _make_user(email: str = "test@test.local") -> User:
    """Create an uncommitted User instance for test data setup."""
    return User(
        email=email,
        password_hash="dummy",
        first_name="Test",
        last_name="User",
        is_verified=True,
    )


# ── Registry ─────────────────────────────────────────────────────────────────


def test_lists_module_registered() -> None:
    """ListsModule is present in the registry with correct identity attributes."""
    # Trigger registration by importing the lists package.
    import halo_api.modules.lists  # noqa: F401 — side effect: register()

    mod = get_module("lists")
    assert mod is not None, "ListsModule should be in the registry"
    assert mod.key == "lists"
    assert mod.tag_prefix == "LIST"
    assert mod.introduced_in == "0.1.0"
    assert mod.router is not None
    assert mod.router.prefix == "/modules/lists"


@pytest.mark.asyncio
async def test_lists_module_enabled_by_default(db_url: str) -> None:
    """sync_registry creates the lists module with enabled=True (active by default)."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    import halo_api.modules.lists  # noqa: F401 — side effect: register()
    from halo_api.modules.registry import is_enabled, sync_registry

    async with session_factory() as session, session.begin():
        await sync_registry(session)

    async with session_factory() as session:
        assert await is_enabled(session, "lists") is True, (
            "lists module must be enabled by default"
        )

    await engine.dispose()
    cleanup_db_file(db_url)


def test_lists_module_models() -> None:
    """models() returns [List, ListItem]."""
    import halo_api.modules.lists  # noqa: F401 — side effect: register()
    from halo_api.modules.lists.models import List as ListModel
    from halo_api.modules.lists.models import ListItem

    mod = get_module("lists")
    assert mod is not None
    models = mod.models()
    assert ListModel in models
    assert ListItem in models
    assert len(models) == 2


def test_lists_module_referable_types() -> None:
    """Only List is referable — ListItem is not exposed to the tag system."""
    import halo_api.modules.lists  # noqa: F401 — side effect: register()

    mod = get_module("lists")
    assert mod is not None
    types = mod.referable_types()
    assert types == [RefType(key="list", label="List")]


def test_lists_module_get_label() -> None:
    """get_label returns French or English label."""
    from halo_api.modules.lists.module import ListsModule

    mod = ListsModule()
    assert mod.get_label("fr") == "Listes"
    assert mod.get_label("en") == "Lists"
    assert mod.get_label("de") == "Lists"  # fallback to English


# ── resolve_refs ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_refs_known(db_url: str) -> None:
    """resolve_refs returns a correct RefHit for a known ref_no."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    from halo_api.modules.lists.module import ListsModule

    mod = ListsModule()

    user = _make_user("resolve-known@test.local")
    async with session_factory() as session, session.begin():
        session.add(user)
        await session.flush()

        lst = List(
            owner_context="personal",
            owner_user_id=user.id,
            ref_no=1,
            title="Courses",
            list_type="tasks",
        )
        session.add(lst)
        await session.flush()

        # Set ContextVar for the module to read.
        current_user_cv.set(user)
        current_session_cv.set(session)

        hits = await mod.resolve_refs([1], "personal")

        assert isinstance(hits, dict)
        assert 1 in hits
        hit = hits[1]
        assert isinstance(hit, RefHit)
        assert hit.tag_prefix == "LIST"
        assert hit.ref_no == 1
        assert hit.uuid == lst.id
        assert hit.title == "Courses"

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_resolve_refs_unknown(db_url: str) -> None:
    """resolve_refs returns an empty dict for a ref_no that doesn't exist."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    from halo_api.modules.lists.module import ListsModule

    mod = ListsModule()

    user = _make_user("resolve-unknown@test.local")
    async with session_factory() as session, session.begin():
        session.add(user)
        await session.flush()

        current_user_cv.set(user)
        current_session_cv.set(session)

        hits = await mod.resolve_refs([999], "personal")
        assert hits == {}

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_resolve_refs_cross_user(db_url: str) -> None:
    """User A cannot resolve ref_nos belonging to User B."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    from halo_api.modules.lists.module import ListsModule

    mod = ListsModule()

    user_a = _make_user("resolve-cross-a@test.local")
    user_b = _make_user("resolve-cross-b@test.local")

    async with session_factory() as session, session.begin():
        session.add_all([user_a, user_b])
        await session.flush()

        list_a = List(
            owner_context="personal",
            owner_user_id=user_a.id,
            ref_no=1,
            title="Liste de A",
            list_type="tasks",
        )
        list_b = List(
            owner_context="personal",
            owner_user_id=user_b.id,
            ref_no=1,
            title="Liste de B",
            list_type="tasks",
        )
        session.add_all([list_a, list_b])
        await session.flush()

        # Act as User A.
        current_user_cv.set(user_a)
        current_session_cv.set(session)

        hits = await mod.resolve_refs([1], "personal")

        # User A should only see their own list.
        assert len(hits) == 1, f"Expected 1 hit, got {len(hits)}: {hits}"
        assert 1 in hits
        assert hits[1].title == "Liste de A"
        assert hits[1].uuid == list_a.id

        # User B's ref_no 1 should NOT be visible to User A.
        # (Only one entry in the dict, already verified above.)

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_resolve_refs_batch_mixed(db_url: str) -> None:
    """resolve_refs returns hits only for existing ref_nos — missing ones are absent."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    from halo_api.modules.lists.module import ListsModule

    mod = ListsModule()

    user = _make_user("resolve-batch@test.local")
    async with session_factory() as session, session.begin():
        session.add(user)
        await session.flush()

        for i, title in enumerate([1, 2, 3], start=1):
            session.add(
                List(
                    owner_context="personal",
                    owner_user_id=user.id,
                    ref_no=i,
                    title=f"List {title}",
                    list_type="tasks",
                )
            )
        await session.flush()

        current_user_cv.set(user)
        current_session_cv.set(session)

        # Request ref_nos 1, 3 (exist) and 999 (does not).
        hits = await mod.resolve_refs([1, 3, 999], "personal")

        assert set(hits.keys()) == {1, 3}
        assert 999 not in hits

    await engine.dispose()
    cleanup_db_file(db_url)


# ── search_titles ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_titles_case_insensitive(db_url: str) -> None:
    """search_titles matches substrings case-insensitively."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    from halo_api.modules.lists.module import ListsModule

    mod = ListsModule()

    user = _make_user("search-case@test.local")
    async with session_factory() as session, session.begin():
        session.add(user)
        await session.flush()

        titles = ["Courses", "Projets", "Vacances"]
        for i, title in enumerate(titles, start=1):
            session.add(
                List(
                    owner_context="personal",
                    owner_user_id=user.id,
                    ref_no=i,
                    title=title,
                    list_type="tasks",
                )
            )
        await session.flush()

        current_user_cv.set(user)
        current_session_cv.set(session)

        # Lowercase query
        hits = await mod.search_titles("cours", "personal")
        assert len(hits) == 1
        assert hits[0].title == "Courses"

        # Uppercase query
        hits = await mod.search_titles("PRO", "personal")
        assert len(hits) == 1
        assert hits[0].title == "Projets"

        # No match
        hits = await mod.search_titles("xyz", "personal")
        assert hits == []

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_search_titles_cross_user(db_url: str) -> None:
    """search_titles only returns lists owned by the current user."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    from halo_api.modules.lists.module import ListsModule

    mod = ListsModule()

    user_a = _make_user("search-cross-a@test.local")
    user_b = _make_user("search-cross-b@test.local")

    async with session_factory() as session, session.begin():
        session.add_all([user_a, user_b])
        await session.flush()

        session.add(
            List(
                owner_context="personal",
                owner_user_id=user_a.id,
                ref_no=1,
                title="Courses A",
                list_type="tasks",
            )
        )
        session.add(
            List(
                owner_context="personal",
                owner_user_id=user_b.id,
                ref_no=1,
                title="Courses B",
                list_type="tasks",
            )
        )
        await session.flush()

        # Search as User A.
        current_user_cv.set(user_a)
        current_session_cv.set(session)

        hits = await mod.search_titles("Courses", "personal")
        assert len(hits) == 1, f"User A should see 1 list, got {len(hits)}"
        assert hits[0].title == "Courses A"

        # Search as User B.
        current_user_cv.set(user_b)

        hits = await mod.search_titles("Courses", "personal")
        assert len(hits) == 1, f"User B should see 1 list, got {len(hits)}"
        assert hits[0].title == "Courses B"

    await engine.dispose()
    cleanup_db_file(db_url)


# ── Outside request context ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_refs_outside_context() -> None:
    """Calling resolve_refs without ContextVar set returns {} and does not raise."""
    from halo_api.modules.lists.module import ListsModule

    mod = ListsModule()
    # Do NOT set current_user_cv or current_session_cv.
    hits = await mod.resolve_refs([1, 2], "personal")
    assert hits == {}


@pytest.mark.asyncio
async def test_search_titles_outside_context() -> None:
    """Calling search_titles without ContextVar set returns [] and does not raise."""
    from halo_api.modules.lists.module import ListsModule

    mod = ListsModule()
    # Do NOT set current_user_cv or current_session_cv.
    hits = await mod.search_titles("test", "personal")
    assert hits == []
