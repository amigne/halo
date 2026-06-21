"""Notifications tests — service-layer, dual-engine (SQLite + PostgreSQL).

Covers: channels_for routing, CRUD operations, user scoping.
Persistence tests are parametrised across both engines via the ``db_url`` fixture.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from halo_api.accounts.models import User, UserNotificationPref
from halo_api.accounts.security import hash_password
from halo_api.notifications.models import Notification
from halo_api.notifications.service import (
    channels_for,
    create_notification,
    list_notifications,
    mark_read,
    unread_count,
)
from tests.conftest import cleanup_db_file, run_alembic

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
        password_hash=hash_password("secret1234"),
        first_name="Test",
        last_name="User",
        is_verified=True,
    )


# ── channels_for ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_channels_for_respects_matrix(db_url: str) -> None:
    """channels_for returns only enabled channels based on prefs matrix."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    user = _make_user("matrix@test.local")
    async with sf() as s, s.begin():
        s.add(user)
        await s.flush()

        # Enable both channels.
        s.add(
            UserNotificationPref(
                user_id=user.id,
                module_key="lists",
                event_type="list_item_due",
                channel="in_app",
                enabled=True,
            )
        )
        s.add(
            UserNotificationPref(
                user_id=user.id,
                module_key="lists",
                event_type="list_item_due",
                channel="email",
                enabled=True,
            )
        )

    async with sf() as s:
        result = await channels_for(s, user.id, "lists", "list_item_due")
        assert result == {"in_app", "email"}

        # Disable in_app and verify.
        await s.execute(
            update(UserNotificationPref)
            .where(
                UserNotificationPref.user_id == user.id,
                UserNotificationPref.module_key == "lists",
                UserNotificationPref.event_type == "list_item_due",
                UserNotificationPref.channel == "in_app",
            )
            .values(enabled=False)
        )
        await s.commit()

        result = await channels_for(s, user.id, "lists", "list_item_due")
        assert result == {"email"}

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_channels_for_disabled_email(db_url: str) -> None:
    """Email channel absent from result when disabled in prefs."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    user = _make_user("noemail@test.local")
    async with sf() as s, s.begin():
        s.add(user)
        await s.flush()

        s.add(
            UserNotificationPref(
                user_id=user.id,
                module_key="lists",
                event_type="list_item_due",
                channel="in_app",
                enabled=True,
            )
        )
        s.add(
            UserNotificationPref(
                user_id=user.id,
                module_key="lists",
                event_type="list_item_due",
                channel="email",
                enabled=False,
            )
        )

    async with sf() as s:
        result = await channels_for(s, user.id, "lists", "list_item_due")
        assert result == {"in_app"}
        assert "email" not in result

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_channels_for_default_when_no_prefs(db_url: str) -> None:
    """When no preference rows exist, both channels are returned (opt-out default)."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    user = _make_user("noprefs@test.local")
    async with sf() as s, s.begin():
        s.add(user)
        await s.flush()

    async with sf() as s:
        result = await channels_for(s, user.id, "lists", "list_item_due")
        assert result == {"in_app", "email"}

    await engine.dispose()
    cleanup_db_file(db_url)


# ── create / list ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_and_list_notifications(db_url: str) -> None:
    """create_notification persists, list_notifications returns DESC order."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    user = _make_user("notif-list@test.local")
    async with sf() as s, s.begin():
        s.add(user)
        await s.flush()

    # Create two notifications.
    async with sf() as s:
        n1 = await create_notification(s, user.id, "list_item_due", {"list_id": "abc"})
        n2 = await create_notification(s, user.id, "comment_added", {"comment_by": "x"})

    # List all — should be DESC by created_at (n2 first).
    async with sf() as s:
        results = await list_notifications(s, user.id)
        assert len(results) == 2
        assert results[0].id == n2.id
        assert results[0].type == "comment_added"
        assert results[1].id == n1.id
        assert results[1].type == "list_item_due"
        assert results[0].payload == {"comment_by": "x"}
        assert results[1].payload == {"list_id": "abc"}

    await engine.dispose()
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_list_unread_only(db_url: str) -> None:
    """list_notifications(unread_only=True) returns only unread notifications."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    user = _make_user("unread-filter@test.local")
    async with sf() as s, s.begin():
        s.add(user)
        await s.flush()

    async with sf() as s:
        n1 = await create_notification(s, user.id, "type_a", {})
        n2 = await create_notification(s, user.id, "type_b", {})

    # Mark n1 as read directly (not via mark_read, to test the filter independently).
    async with sf() as s, s.begin():
        await s.execute(
            update(Notification)
            .where(Notification.id == n1.id)
            .values(read_at=datetime.now(UTC))
        )

    async with sf() as s:
        results = await list_notifications(s, user.id, unread_only=True)
        assert len(results) == 1
        assert results[0].id == n2.id

    await engine.dispose()
    cleanup_db_file(db_url)


# ── mark_read ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mark_read(db_url: str) -> None:
    """mark_read sets read_at to a UTC timestamp."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    user = _make_user("markread@test.local")
    async with sf() as s, s.begin():
        s.add(user)
        await s.flush()

    async with sf() as s:
        notif = await create_notification(s, user.id, "type_x", {})

    # Mark it read.
    async with sf() as s:
        before = datetime.now(UTC)
        await mark_read(s, user.id, notif.id)
        after = datetime.now(UTC)

    # Verify read_at is set.
    async with sf() as s:
        result = await s.execute(
            select(Notification).where(Notification.id == notif.id)
        )
        refreshed = result.scalar_one()
        assert refreshed.read_at is not None
        # SQLite may return a naive datetime — treat as UTC.
        read_at = refreshed.read_at
        if read_at.tzinfo is None:
            read_at = read_at.replace(tzinfo=UTC)
        assert before <= read_at <= after

    await engine.dispose()
    cleanup_db_file(db_url)


# ── unread_count ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unread_count(db_url: str) -> None:
    """unread_count returns the number of notifications with read_at IS NULL."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    user = _make_user("unreadcnt@test.local")
    async with sf() as s, s.begin():
        s.add(user)
        await s.flush()

    async with sf() as s:
        _n1 = await create_notification(s, user.id, "type_a", {})
        n2 = await create_notification(s, user.id, "type_b", {})
        _n3 = await create_notification(s, user.id, "type_c", {})

    # Mark n2 as read.
    async with sf() as s, s.begin():
        await s.execute(
            update(Notification)
            .where(Notification.id == n2.id)
            .values(read_at=datetime.now(UTC))
        )

    async with sf() as s:
        count = await unread_count(s, user.id)
        assert count == 2

    await engine.dispose()
    cleanup_db_file(db_url)


# ── User scoping (security) ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_user_scoping(db_url: str) -> None:
    """A user cannot list or mark-read another user's notifications."""
    _prepare_db(db_url)

    engine = create_async_engine(db_url, echo=False)
    sf = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    user_a = _make_user("user-a@test.local")
    user_b = _make_user("user-b@test.local")
    async with sf() as s, s.begin():
        s.add(user_a)
        s.add(user_b)
        await s.flush()

    # Create a notification for user A.
    async with sf() as s:
        notif_a = await create_notification(s, user_a.id, "type_x", {})

    # User B cannot see user A's notifications.
    async with sf() as s:
        results = await list_notifications(s, user_b.id)
        assert len(results) == 0

    # User B cannot mark user A's notification as read.
    async with sf() as s:
        await mark_read(s, user_b.id, notif_a.id)

    # Verify user A's notification is still unread.
    async with sf() as s:
        result = await s.execute(
            select(Notification).where(Notification.id == notif_a.id)
        )
        refreshed = result.scalar_one()
        assert refreshed.read_at is None

    await engine.dispose()
    cleanup_db_file(db_url)
