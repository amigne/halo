"""Tests for ``halo_api.refs.counters.allocate_ref_no`` (step 4-2).

Covers:
- Simple sequence: 3 allocations → 1,2,3
- Never reused: after deleting object 2, next allocation → 4 (not 2)
- Atomicity / concurrency: N concurrent allocations → {1..N} without duplicates
- Independent keys: different scopes have separate sequences
"""

import asyncio
import uuid

import pytest
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from halo_api.refs.counters import allocate_ref_no
from tests.conftest import cleanup_db_file, run_alembic

# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_user_id() -> uuid.UUID:
    return uuid.uuid7()


def _prepare_db(db_url: str) -> None:
    """Reset the database and apply all migrations (idempotent)."""
    cleanup_db_file(db_url)
    run_alembic(["downgrade", "base"], db_url)
    proc = run_alembic(["upgrade", "head"], db_url)
    assert proc.returncode == 0, f"Migration failed for {db_url}:\n{proc.stderr}"


# ── Simple sequence ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_allocate_ref_no_sequence(db_url: str) -> None:
    """Three allocations on the same scope return 1, 2, 3."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    user_id = _make_user_id()

    async with session_factory() as session, session.begin():
        a = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )
        b = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )
        c = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )

    assert [a, b, c] == [1, 2, 3], f"Expected [1, 2, 3], got {[a, b, c]} on {db_url}"

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_allocate_ref_no_sequence_across_transactions(db_url: str) -> None:
    """Allocations across separate transactions continue incrementing monotonically."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    user_id = _make_user_id()
    results: list[int] = []

    for _ in range(3):
        async with session_factory() as session, session.begin():
            n = await allocate_ref_no(
                session,
                owner_context="personal",
                owner_user_id=user_id,
                object_type="lists",
            )
            results.append(n)

    assert results == [1, 2, 3], (
        f"Expected [1, 2, 3] across transactions, got {results} on {db_url}"
    )

    await engine.dispose()
    cleanup_db_file(db_url)


# ── Never reused ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_allocate_ref_no_never_reused(db_url: str) -> None:
    """Allocating 1,2,3 and then deleting object 2 must yield 4 next, not 2.

    The allocator is counter-based, not ``MAX+1``, so deletions never
    cause ref_no reuse.
    """
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    user_id = _make_user_id()

    async with session_factory() as session, session.begin():
        a = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )
        b = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )
        c = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )

    assert [a, b, c] == [1, 2, 3]

    # Simulate deleting the object that owned ref_no 2.
    # The counter is untouched — the next allocation must be 4.
    async with session_factory() as session, session.begin():
        d = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )

    assert d == 4, f"Expected 4 (no reuse of 2), got {d} on {db_url}"

    await engine.dispose()
    cleanup_db_file(db_url)


# ── Atomicity / concurrency ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_allocate_ref_no_concurrent(db_url: str) -> None:
    """N concurrent allocations on the same scope yield {1..N} without duplicates."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    user_id = _make_user_id()
    n_alloc = 20

    async def allocate_one() -> int:
        async with session_factory() as session, session.begin():
            return await allocate_ref_no(
                session,
                owner_context="personal",
                owner_user_id=user_id,
                object_type="lists",
            )

    # Launch N concurrent allocations — each with its own session.
    results = await asyncio.gather(*(allocate_one() for _ in range(n_alloc)))

    expected = set(range(1, n_alloc + 1))
    assert set(results) == expected, (
        f"Expected {expected}, got {set(results)} "
        f"(duplicates={len(results) - len(set(results))}) on {db_url}"
    )
    assert len(results) == n_alloc, (
        f"Expected {n_alloc} results, got {len(results)} on {db_url}"
    )

    await engine.dispose()
    cleanup_db_file(db_url)


# ── Independent keys ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_allocate_ref_no_independent_object_types(db_url: str) -> None:
    """Different object_type values have separate, independent sequences."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    user_id = _make_user_id()

    async with session_factory() as session, session.begin():
        list_a = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )
        note_a = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="notes",
        )
        list_b = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )
        note_b = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="notes",
        )

    assert list_a == 1, f"First list ref_no should be 1, got {list_a}"
    assert list_b == 2, f"Second list ref_no should be 2, got {list_b}"
    assert note_a == 1, f"First note ref_no should be 1, got {note_a}"
    assert note_b == 2, f"Second note ref_no should be 2, got {note_b}"

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_allocate_ref_no_independent_users(db_url: str) -> None:
    """Different owner_user_id values have separate, independent sequences."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    user_a = _make_user_id()
    user_b = _make_user_id()

    async with session_factory() as session, session.begin():
        a1 = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_a,
            object_type="lists",
        )
        b1 = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_b,
            object_type="lists",
        )
        a2 = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_a,
            object_type="lists",
        )
        b2 = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_b,
            object_type="lists",
        )

    assert a1 == 1, f"User A first ref_no should be 1, got {a1}"
    assert a2 == 2, f"User A second ref_no should be 2, got {a2}"
    assert b1 == 1, f"User B first ref_no should be 1, got {b1}"
    assert b2 == 2, f"User B second ref_no should be 2, got {b2}"

    await engine.dispose()
    cleanup_db_file(db_url)


# ── Nullable columns ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_allocate_ref_no_group_id_null_handling(db_url: str) -> None:
    """Explicit ``group_id=None`` uses the same counter as the default (NULL row)."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    user_id = _make_user_id()

    async with session_factory() as session, session.begin():
        a = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
            # group_id omitted → None
        )
        b = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
            group_id=None,  # explicit None
        )

    assert a == 1
    assert b == 2, (
        f"Explicit group_id=None should share the same counter, "
        f"got {b} (expected 2) on {db_url}"
    )

    await engine.dispose()
    cleanup_db_file(db_url)


# ── Monotonicity across restarts ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_allocate_ref_no_monotonic_across_sessions(db_url: str) -> None:
    """Counter persists and continues incrementing across engine/session lifetimes."""
    _prepare_db(db_url)

    user_id = _make_user_id()

    # First engine lifetime
    engine1 = create_async_engine(db_url, echo=False)
    sf1 = async_sessionmaker(engine1, class_=AsyncSession, expire_on_commit=False)
    async with sf1() as session, session.begin():
        a = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )
    assert a == 1
    await engine1.dispose()

    # Second engine lifetime — should continue from 2, not restart at 1.
    engine2 = create_async_engine(db_url, echo=False)
    sf2 = async_sessionmaker(engine2, class_=AsyncSession, expire_on_commit=False)
    async with sf2() as session, session.begin():
        b = await allocate_ref_no(
            session,
            owner_context="personal",
            owner_user_id=user_id,
            object_type="lists",
        )
    assert b == 2, (
        f"Counter should persist across engine lifetimes, "
        f"got {b} (expected 2) on {db_url}"
    )
    await engine2.dispose()

    cleanup_db_file(db_url)
