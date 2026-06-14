"""FastAPI dependencies for authentication and authorization."""

from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from halo_api.accounts.models import User
from halo_api.accounts.session import (
    COOKIE_NAME,
    get_user_from_token,
)
from halo_api.core.db import get_session


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_session),
    token: str | None = Cookie(alias=COOKIE_NAME, default=None),
) -> User:
    """FastAPI dependency — return the currently authenticated User.

    Raises HTTP 401 if no valid session cookie is present.
    """
    if token is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "Authentication required"},
        )

    user = await get_user_from_token(db, token)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "Invalid or expired session"},
        )

    from halo_api.core.context import current_user_cv

    current_user_cv.set(user)
    return user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_session),
    token: str | None = Cookie(alias=COOKIE_NAME, default=None),
) -> User | None:
    """FastAPI dependency — return the current User or ``None``.

    Does NOT raise 401 — useful for endpoints that work both
    authenticated and anonymous.
    """
    if token is None:
        return None
    return await get_user_from_token(db, token)


async def require_admin(
    user: User = Depends(get_current_user),
) -> User:
    """FastAPI dependency — require the current user to be an admin.

    Raises HTTP 403 if the user is authenticated but not an admin.
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Admin privileges required"},
        )
    return user
