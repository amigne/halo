"""Auth routes — register, login, logout, verify, reset (specs/01 §1, specs/03 §7-8).

Anti-enumeration (T-083): register, login, and forgot-password return
identically-structured responses regardless of whether the email exists.
"""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from halo_api.accounts.deps import get_optional_user
from halo_api.accounts.models import EmailToken, User
from halo_api.accounts.schemas import (
    AuthStatus,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
)
from halo_api.accounts.security import (
    generate_token,
    hash_password,
    token_expires_at,
    verify_password,
)
from halo_api.accounts.session import (
    create_session,
    delete_session_cookie,
    invalidate_session,
    set_session_cookie,
)
from halo_api.core.config import settings
from halo_api.core.db import get_session
from halo_api.core.rate_limit import rate_limit

logger = logging.getLogger("halo.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Helpers ──────────────────────────────────────────────────────────────────


async def _email_exists(db: AsyncSession, email: str) -> bool:
    """Check whether *email* (lowercased) is already registered."""
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none() is not None


# ── Register (F-001, F-002) ──────────────────────────────────────────────────


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=201,
    dependencies=[
        Depends(
            rate_limit(
                settings.rate_limit_register_per_hour,
                3600,
                "register",
            )
        )
    ],
)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """Register a new user account.

    The response is the **same** whether the email already exists or not
    (anti-enumeration, T-083).  A verification email is only sent for new
    accounts.
    """
    email_lower = body.email.lower().strip()

    if await _email_exists(db, email_lower):
        # Anti-enumeration: return the same success message
        logger.info("Registration attempt for existing email")
        return MessageResponse(
            message="If the email is not already registered, "
            "a verification email has been sent."
        )

    # Create user
    user = User(
        email=email_lower,
        password_hash=hash_password(body.password),
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        is_admin=False,
        is_verified=False,
        locale=body.locale,
        theme=body.theme,
        timezone=body.timezone,
    )
    db.add(user)
    await db.flush()  # Populate user.id

    # Generate email verification token
    cleartext, token_hash_val = generate_token()
    email_token = EmailToken(
        user_id=user.id,
        purpose="verify",
        token_hash=token_hash_val,
        expires_at=token_expires_at(),
    )
    db.add(email_token)
    await db.commit()

    # Enqueue verification email
    from halo_api.worker.email import enqueue_email_job

    await enqueue_email_job(
        {
            "kind": "verify",
            "email": user.email,
            "first_name": user.first_name,
            "locale": user.locale,
            "token": cleartext,
        }
    )

    logger.info("User registered: %s", user.email)
    return MessageResponse(
        message="If the email is not already registered, "
        "a verification email has been sent."
    )


# ── Verify email (F-003) ─────────────────────────────────────────────────────


@router.get("/verify-email", response_model=MessageResponse)
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """Verify an email address using a CSPRNG token (T-081, T-082).

    The token is single-use and has a limited lifetime.
    """
    # Look up the token by hash
    from halo_api.accounts.security import hash_token

    token_hash_val = hash_token(token)
    result = await db.execute(
        select(EmailToken).where(
            EmailToken.token_hash == token_hash_val,
            EmailToken.purpose == "verify",
        )
    )
    email_token = result.scalar_one_or_none()

    if email_token is None:
        return MessageResponse(message="Invalid or expired verification link.")

    # Check expiry
    if email_token.expires_at < datetime.now(UTC):
        return MessageResponse(message="Invalid or expired verification link.")

    # Check single-use
    if email_token.used_at is not None:
        return MessageResponse(message="Invalid or expired verification link.")

    # Mark as used
    email_token.used_at = datetime.now(UTC)

    # Verify the user
    if email_token.user_id is not None:
        user_result = await db.execute(
            select(User).where(User.id == email_token.user_id)
        )
        user = user_result.scalar_one_or_none()
        if user is not None:
            user.is_verified = True

    await db.commit()
    logger.info("Email verified for user_id=%s", email_token.user_id)
    return MessageResponse(message="Email verified successfully. You can now log in.")


# ── Login (F-005) ────────────────────────────────────────────────────────────


@router.post(
    "/login",
    response_model=UserResponse,
    dependencies=[
        Depends(
            rate_limit(
                settings.rate_limit_login_per_minute,
                60,
                "login",
            )
        )
    ],
)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_session),
) -> UserResponse:
    """Authenticate with email + password, create a session cookie (T-070).

    Anti-enumeration (T-083): returns the same error for unknown email and
    wrong password.
    """
    email_lower = body.email.lower().strip()

    result = await db.execute(select(User).where(User.email == email_lower))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        # Uniform error — no indication whether email exists
        raise _invalid_credentials()

    # Create session
    ip = request.client.host if request.client else None
    ua = request.headers.get("User-Agent")
    token = await create_session(db, user, ip=ip, ua=ua)
    set_session_cookie(response, token)

    logger.info("User logged in: %s", user.email)
    return UserResponse.model_validate(user)


def _invalid_credentials() -> Exception:
    from fastapi import HTTPException

    return HTTPException(
        status_code=401,
        detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"},
    )


# ── Logout (T-072) ───────────────────────────────────────────────────────────


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """Invalidate the current session (server-side) and clear the cookie."""
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        await invalidate_session(db, token)

    delete_session_cookie(response)
    return MessageResponse(message="Logged out successfully.")


# ── Current user ─────────────────────────────────────────────────────────────


@router.get("/me", response_model=AuthStatus)
async def me(
    user: User | None = Depends(get_optional_user),
) -> AuthStatus:
    """Return the currently authenticated user, or {authenticated: false}."""
    if user is None:
        return AuthStatus(authenticated=False)
    return AuthStatus(
        authenticated=True,
        user=UserResponse.model_validate(user),
    )


# ── Forgot password (F-006) ──────────────────────────────────────────────────


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    dependencies=[
        Depends(
            rate_limit(
                settings.rate_limit_reset_per_hour,
                3600,
                "reset",
            )
        )
    ],
)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """Request a password reset email.

    Anti-enumeration (T-083): always returns the same message, regardless
    of whether the email exists.  If the email is not found, the request
    is silently dropped.
    """
    email_lower = body.email.lower().strip()

    result = await db.execute(select(User).where(User.email == email_lower))
    user = result.scalar_one_or_none()

    if user is not None:
        cleartext, token_hash_val = generate_token()
        email_token = EmailToken(
            user_id=user.id,
            purpose="reset",
            token_hash=token_hash_val,
            expires_at=token_expires_at(),
        )
        db.add(email_token)
        await db.commit()

        from halo_api.worker.email import enqueue_email_job

        await enqueue_email_job(
            {
                "kind": "reset",
                "email": user.email,
                "first_name": user.first_name,
                "locale": user.locale,
                "token": cleartext,
            }
        )

        logger.info("Password reset requested for %s", user.email)

    # Always return the same message
    return MessageResponse(
        message="If the email is registered, a password reset link has been sent."
    )


# ── Reset password (F-006) ───────────────────────────────────────────────────


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """Reset the password using a CSPRNG token.

    The token is single-use and has a limited lifetime (T-081, T-082).
    """
    from halo_api.accounts.security import hash_token

    token_hash_val = hash_token(body.token)
    result = await db.execute(
        select(EmailToken).where(
            EmailToken.token_hash == token_hash_val,
            EmailToken.purpose == "reset",
        )
    )
    email_token = result.scalar_one_or_none()

    if email_token is None:
        return MessageResponse(message="Invalid or expired reset link.")

    if email_token.expires_at < datetime.now(UTC):
        return MessageResponse(message="Invalid or expired reset link.")

    if email_token.used_at is not None:
        return MessageResponse(message="Invalid or expired reset link.")

    # Mark token as used
    email_token.used_at = datetime.now(UTC)

    # Update password
    if email_token.user_id is not None:
        user_result = await db.execute(
            select(User).where(User.id == email_token.user_id)
        )
        user = user_result.scalar_one_or_none()
        if user is not None:
            user.password_hash = hash_password(body.password)

    await db.commit()
    logger.info("Password reset for user_id=%s", email_token.user_id)
    return MessageResponse(message="Password reset successfully. You can now log in.")
