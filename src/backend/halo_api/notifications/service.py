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


async def channels_for(
    db: AsyncSession,
    user_id: uuid.UUID,
    module_key: str,
    event_type: str,
) -> set[str]:
    """Return the set of enabled channel names for a given notification event.

    Queries ``user_notification_prefs`` for rows matching *user_id*,
    *module_key*, *event_type*, and ``enabled=True``.

    **Default**: when no preference rows exist for the combination, the
    function conservatively returns ``{"in_app", "email"}`` — notification
    delivery is opt-out, not opt-in.  This ensures users receive
    notifications until they explicitly disable a channel.
    """
    result = await db.execute(
        select(UserNotificationPref.channel).where(
            UserNotificationPref.user_id == user_id,
            UserNotificationPref.module_key == module_key,
            UserNotificationPref.event_type == event_type,
            UserNotificationPref.enabled.is_(True),
        )
    )
    channels = {row[0] for row in result.all()}
    if not channels:
        return {"in_app", "email"}
    return channels


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
