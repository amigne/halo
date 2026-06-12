"""SQLAlchemy ORM model for ``ref_counters`` — generic monotonic counter (specs/03 §4).

One row per (owner_context, owner_user_id, group_id, object_type) tuple.
"""

import uuid

from sqlalchemy import Integer, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.schema import Index

from halo_api.core.db import Base, UUIDPKMixin


class RefCounter(UUIDPKMixin, Base):
    """Next available ``ref_no`` for a given scope + object type.

    Scope is defined by the composite (owner_context, owner_user_id,
    group_id).  ``object_type`` is the module's machine-readable slug
    (e.g. ``"lists"``).

    ``owner_user_id`` and ``group_id`` are nullable to support
    context-wide counters in future iterations.  For personal contexts
    (v0.1) ``owner_user_id`` is always set and ``group_id`` is NULL.
    """

    __tablename__ = "ref_counters"

    owner_context: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Context key, e.g. 'personal'"
    )
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), nullable=True, comment="FK → users.id (future constraint)"
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), nullable=True, comment="Group scope — unused in v0.1"
    )
    object_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Module slug, e.g. 'lists'"
    )
    next_value: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False, comment="Next ref_no to allocate"
    )

    __table_args__ = (
        Index(
            "uq_ref_counters_scope",
            "owner_context",
            "owner_user_id",
            text("COALESCE(group_id, '00000000-0000-0000-0000-000000000000')"),
            "object_type",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<RefCounter {self.owner_context}/{self.object_type} "
            f"user={self.owner_user_id!r} group={self.group_id!r} "
            f"next={self.next_value}>"
        )
