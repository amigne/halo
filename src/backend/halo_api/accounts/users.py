"""User profile & notification preferences endpoints (specs/01 §2 F-020..F-024).

Protected by ``get_current_user`` and CSRF on mutating operations.
"""

import logging
from datetime import UTC, datetime

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from halo_api.accounts.deps import get_current_user
from halo_api.accounts.models import User, UserNotificationPref
from halo_api.accounts.schemas import (
    NotificationPrefRequest,
    NotificationPrefResponse,
    UserResponse,
    UserUpdateRequest,
)
from halo_api.core.db import get_session

logger = logging.getLogger("halo.users")

router = APIRouter(prefix="/users", tags=["users"])


# ── Helpers ──────────────────────────────────────────────────────────────────


def _validate_timezone(tz: str) -> bool:
    """Return True if *tz* looks like a valid IANA timezone name.

    Accepts the names returned by Intl.DateTimeFormat().resolvedOptions().timeZone,
    which are always valid IANA identifiers (e.g. "Europe/Paris", "America/New_York").
    We accept a broad pattern: Area/Location with optional subdivisions.
    """
    if not tz or len(tz) > 50:
        return False
    # IANA timezone names are ASCII letters, digits, slash, underscore, hyphen, plus.
    # Pattern: at least one slash, reasonable characters.
    parts = tz.split("/")
    if len(parts) < 2:
        return False
    for part in parts:
        if not part:
            return False
        if not all(c.isascii() and (c.isalnum() or c in "_-+") for c in part):
            return False
    return True


# ── Profile endpoints ────────────────────────────────────────────────────────


@router.get("/me", response_model=UserResponse)
async def get_profile(
    user: User = Depends(get_current_user),
) -> UserResponse:
    """Return the current user's profile (F-020)."""
    return UserResponse.model_validate(user)


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    body: UserUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UserResponse:
    """Partially update the current user's profile (F-021, F-022).

    Only the non-None fields in *body* are applied.  Validates theme,
    locale, and timezone values.
    """
    updates: dict[str, object] = {}

    if body.first_name is not None:
        updates["first_name"] = body.first_name.strip()
    if body.last_name is not None:
        updates["last_name"] = body.last_name.strip()
    if body.theme is not None:
        if body.theme not in {"light", "dark", "system"}:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "VALIDATION_ERROR",
                    "message": "theme must be one of: light, dark, system",
                },
            )
        updates["theme"] = body.theme
    if body.locale is not None:
        if body.locale not in {"fr", "en"}:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "VALIDATION_ERROR",
                    "message": "locale must be one of: fr, en",
                },
            )
        updates["locale"] = body.locale
    if body.timezone is not None:
        if not _validate_timezone(body.timezone):
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "VALIDATION_ERROR",
                    "message": f"Invalid IANA timezone: {body.timezone!r}",
                },
            )
        updates["timezone"] = body.timezone

    if not updates:
        # Nothing to update — return current state
        return UserResponse.model_validate(user)

    # Apply updates
    for key, value in updates.items():
        setattr(user, key, value)
    user.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(user)

    logger.info("User profile updated: %s fields=%s", user.email, list(updates.keys()))
    return UserResponse.model_validate(user)


# ── Notification preferences endpoints ───────────────────────────────────────


@router.get(
    "/me/notification-prefs",
    response_model=list[NotificationPrefResponse],
)
async def list_notification_prefs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[NotificationPrefResponse]:
    """Return all notification preferences for the current user (F-023)."""
    result = await db.execute(
        sa.select(UserNotificationPref).where(UserNotificationPref.user_id == user.id)
    )
    prefs = result.scalars().all()
    return [NotificationPrefResponse.model_validate(p) for p in prefs]


@router.put(
    "/me/notification-prefs",
    response_model=NotificationPrefResponse,
)
async def upsert_notification_pref(
    body: NotificationPrefRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> NotificationPrefResponse:
    """Upsert a single notification preference entry (F-024).

    If a preference for the same (user_id, module_key, event_type, channel)
    already exists, its ``enabled`` flag is updated.  Otherwise a new
    preference is created.  The operation is idempotent.
    """
    # Look for an existing preference with the same unique key
    result = await db.execute(
        sa.select(UserNotificationPref).where(
            UserNotificationPref.user_id == user.id,
            UserNotificationPref.module_key == body.module_key,
            UserNotificationPref.event_type == body.event_type,
            UserNotificationPref.channel == body.channel,
        )
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.enabled = body.enabled
        await db.commit()
        await db.refresh(existing)
        return NotificationPrefResponse.model_validate(existing)

    # Create new preference
    pref = UserNotificationPref(
        user_id=user.id,
        module_key=body.module_key,
        event_type=body.event_type,
        channel=body.channel,
        enabled=body.enabled,
    )
    db.add(pref)
    await db.commit()
    await db.refresh(pref)

    return NotificationPrefResponse.model_validate(pref)
