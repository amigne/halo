"""Pydantic v2 request/response schemas for accounts & auth."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# Simple email regex (avoids email-validator dependency)
_EMAIL_PATTERN = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"


class RegisterRequest(BaseModel):
    """Registration payload (F-001)."""

    email: str = Field(min_length=5, max_length=255, pattern=_EMAIL_PATTERN)
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    locale: str = Field(default="en", pattern=r"^[a-z]{2}$")
    theme: str = Field(default="system", pattern=r"^(light|dark|system)$")
    timezone: str = Field(default="UTC", min_length=1, max_length=50)


class LoginRequest(BaseModel):
    """Login payload."""

    email: str = Field(min_length=5, max_length=255, pattern=_EMAIL_PATTERN)
    password: str


class ForgotPasswordRequest(BaseModel):
    """Forgot-password payload (email only — anti-enumeration, T-083)."""

    email: str = Field(min_length=5, max_length=255, pattern=_EMAIL_PATTERN)


class ResetPasswordRequest(BaseModel):
    """Reset-password payload (token + new password)."""

    token: str
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    """Public user profile returned by the API."""

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    is_admin: bool
    is_verified: bool
    locale: str
    theme: str
    timezone: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AuthStatus(BaseModel):
    """Current authentication status (/auth/me)."""

    authenticated: bool
    user: UserResponse | None = None


class MessageResponse(BaseModel):
    """Generic message response (anti-enumeration uniform shape)."""

    message: str
