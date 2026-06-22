"""Notification service — pure async functions for the notifications table.

All functions receive an ``AsyncSession`` as their first argument.
Callers are responsible for providing the session; functions that
mutate the database commit and refresh internally.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from halo_api.accounts.models import UserNotificationPref
from halo_api.notifications.models import Notification

#: All delivery channels. Every channel is enabled by default (opt-out); a
#: channel is excluded only when a preference row explicitly disables it.
ALL_CHANNELS: frozenset[str] = frozenset({"in_app", "email"})


async def channels_for(
    db: AsyncSession,
    user_id: uuid.UUID,
    module_key: str,
    event_type: str,
) -> set[str]:
    """Return the set of enabled channel names for a given notification event.

    **Opt-out model**: every channel is ON by default; a channel is only
    excluded when an explicit preference row sets ``enabled=False``.

    Preference rows are created lazily (one per toggled channel), so we must
    distinguish "no preference at all" from "this channel was disabled".
    Collecting only ``enabled=True`` rows and defaulting when the set is empty
    is wrong: disabling a single channel leaves zero enabled rows and would
    then re-enable *every* channel via the default. Instead we start from all
    known channels and remove the ones explicitly disabled — so disabling a
    channel removes it from routing (and disabling all yields an empty set).
    """
    result = await db.execute(
        select(
            UserNotificationPref.channel,
            UserNotificationPref.enabled,
        ).where(
            UserNotificationPref.user_id == user_id,
            UserNotificationPref.module_key == module_key,
            UserNotificationPref.event_type == event_type,
        )
    )
    prefs = {channel: enabled for channel, enabled in result.all()}
    # Channels with no row default to ON (opt-out); explicit False removes them.
    return {channel for channel in ALL_CHANNELS if prefs.get(channel, True)}


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    payload: dict[str, Any],
) -> Notification:
    """Insert a new notification, commit, and return the refreshed instance.

    This only creates an in-app notification row.  It does **not** trigger
    email or WebSocket delivery (those are handled in later steps).
    """
    notif = Notification(user_id=user_id, type=type, payload=payload)
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return notif


async def list_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    unread_only: bool = False,
) -> list[Notification]:
    """Return notifications for *user_id*, ordered by ``created_at DESC``.

    When *unread_only* is ``True``, only notifications where ``read_at IS NULL``
    are returned.
    """
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    stmt = stmt.order_by(Notification.created_at.desc(), Notification.id.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def mark_read(
    db: AsyncSession,
    user_id: uuid.UUID,
    notif_id: uuid.UUID,
) -> None:
    """Mark a single notification as read by setting ``read_at = now()``.

    The update is scoped to both *user_id* and *notif_id* — a user cannot
    mark another user's notifications as read.  If no matching row exists,
    the call is a silent no-op.
    """
    await db.execute(
        update(Notification)
        .where(Notification.id == notif_id, Notification.user_id == user_id)
        .values(read_at=datetime.now(UTC))
    )
    await db.commit()


async def unread_count(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> int:
    """Return the number of unread notifications for *user_id*."""
    result = await db.execute(
        select(func.count()).where(
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
        )
    )
    return result.scalar_one()
