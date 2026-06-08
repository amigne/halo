"""Session management — cookie-based, revocable server-side (T-070, T-072).

Sessions are stored in the ``sessions`` table.  The cookie holds an opaque
token; the database holds its SHA-256 hash.
"""

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from halo_api.accounts.models import Session, User
from halo_api.accounts.security import hash_token
from halo_api.core.config import settings

COOKIE_NAME = settings.session_cookie_name


async def create_session(
    db: AsyncSession,
    user: User,
    ip: str | None = None,
    ua: str | None = None,
) -> str:
    """Create a new session for *user*, persist to DB, return the token.

    The returned *token* (opaque, 256-bit CSPRNG) should be set as a cookie.
    Only its SHA-256 hash is stored in the database.
    """
    # Generate opaque session token
    token = secrets.token_urlsafe(32)
    token_hash_val = hash_token(token)

    session = Session(
        user_id=user.id,
        token_hash=token_hash_val,
        ip=ip,
        ua=ua,
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.session_ttl_minutes),
    )
    db.add(session)
    await db.commit()

    return token


async def invalidate_session(
    db: AsyncSession,
    token: str,
) -> bool:
    """Delete the session matching *token* from the database.

    Returns ``True`` if a session was deleted, ``False`` otherwise.
    """
    token_hash_val = hash_token(token)
    result = await db.execute(
        select(Session).where(Session.token_hash == token_hash_val)
    )
    session = result.scalar_one_or_none()
    if session is None:
        return False
    await db.delete(session)
    await db.commit()
    return True


async def get_user_from_token(
    db: AsyncSession,
    token: str,
) -> User | None:
    """Return the User associated with *token*, or ``None``.

    Checks that the session exists and has not expired.
    """
    token_hash_val = hash_token(token)
    result = await db.execute(
        select(Session)
        .where(Session.token_hash == token_hash_val)
        .where(Session.expires_at > datetime.now(UTC))
    )
    session = result.scalar_one_or_none()
    if session is None:
        return None

    # Load the associated user
    user_result = await db.execute(select(User).where(User.id == session.user_id))
    return user_result.scalar_one_or_none()


def set_session_cookie(response: Response, token: str) -> None:
    """Set the session cookie on *response*."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.session_secure_cookie,
        samesite="lax",
        path="/api",
        max_age=settings.session_ttl_minutes * 60,
    )


def delete_session_cookie(response: Response) -> None:
    """Remove the session cookie from *response*."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/api",
        httponly=True,
        secure=settings.session_secure_cookie,
        samesite="lax",
    )
