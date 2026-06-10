"""SQLAlchemy ORM models for accounts & authentication (specs/03 §5.1).

Users, sessions, and email tokens — all use UUIDv7 primary keys via
``UUIDPKMixin``.  Email columns use plain ``String`` with application-level
lower-casing instead of citext (T-142).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from halo_api.core.db import Base, UUIDPKMixin


class User(UUIDPKMixin, Base):
    """Application user (specs/03 §5.1)."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_blocked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Created for v0.0.2, functionally unused until v0.2.0",
    )
    locale: Mapped[str] = mapped_column(String(5), default="en", nullable=False)
    theme: Mapped[str] = mapped_column(String(10), default="system", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    sessions: Mapped[list[Session]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    notification_prefs: Mapped[list[UserNotificationPref]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.email!r}>"


class Session(UUIDPKMixin, Base):
    """User session — cookie-based, revocable server-side (T-070, T-072)."""

    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    ua: Mapped[str | None] = mapped_column(String(512), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped[User] = relationship(back_populates="sessions")

    def __repr__(self) -> str:
        return f"<Session {self.id!r} user={self.user_id!r}>"


class UserNotificationPref(UUIDPKMixin, Base):
    """Per-user, per-event notification preference (specs/01 §2 F-020..F-024).

    Stores whether a given notification event type should be delivered
    via a given channel.  This is the *preference scaffold* only — no
    notifications are actually emitted until étape 6.
    """

    __tablename__ = "user_notification_prefs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    module_key: Mapped[str] = mapped_column(String(64), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    channel: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="'in_app' or 'email'"
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user: Mapped[User] = relationship(back_populates="notification_prefs")

    def __repr__(self) -> str:
        return (
            f"<UserNotificationPref user={self.user_id!r} "
            f"{self.module_key}/{self.event_type}@{self.channel} "
            f"enabled={self.enabled}>"
        )


class EmailToken(UUIDPKMixin, Base):
    """Single-use token for email verification or password reset (T-081, T-082).

    Only the SHA-256 hash of the token is stored.  The cleartext token is
    CSPRNG-generated and sent via email — it never hits the database.
    """

    __tablename__ = "email_tokens"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    purpose: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="'verify' or 'reset'"
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<EmailToken {self.purpose!r} user={self.user_id!r}>"
