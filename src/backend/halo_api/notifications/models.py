"""SQLAlchemy ORM model for notifications (specs/06 step 6-1).

One row per delivered notification.  The ``type`` field identifies the event
(e.g. ``list_item_due``); ``payload`` carries event-specific data as JSON.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from halo_api.accounts.models import User
from halo_api.core.db import Base, PortableJSON, UUIDPKMixin


class Notification(UUIDPKMixin, Base):
    """Delivered notification — persisted until explicitly deleted."""

    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Event type key, e.g. 'list_item_due'"
    )
    payload: Mapped[dict[str, Any]] = mapped_column(
        PortableJSON,
        nullable=False,
        default=dict,
        comment="Event-specific JSON payload",
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="UTC timestamp when read"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # One-way relationship — User does not have a backref yet.
    user: Mapped[User] = relationship(foreign_keys=[user_id])

    def __repr__(self) -> str:
        return (
            f"<Notification id={self.id!r} user={self.user_id!r} "
            f"type={self.type!r} read_at={self.read_at!r}>"
        )
