"""SQLAlchemy ORM models for the Lists module (specs/03 §5, specs/01 §10.1).

``List`` — a user-owned collection with a human-readable ``ref_no``.
``ListItem`` — an item within a list; not independently referenceable.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from halo_api.core.db import Base, PortableJSON, UUIDPKMixin


class List(UUIDPKMixin, Base):
    """User-owned list (specs/01 §10.1, specs/03 §5).

    Identified externally by the human-readable tag ``{LIST:ref_no}``
    where ``ref_no`` is unique per (owner_context, owner_user_id).
    """

    __tablename__ = "lists"

    # -- human-readable identifier -------------------------------------------------
    ref_no: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Human-readable ref_no — {LIST:ref_no}"
    )

    # -- ownership scope -----------------------------------------------------------
    owner_context: Mapped[str] = mapped_column(
        String(50), nullable=False, default="personal", comment="Scope key"
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
        comment="FK → users.id",
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), nullable=True, comment="Group scope — unused in v0.1"
    )

    # -- content -------------------------------------------------------------------
    title: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="List title"
    )
    icon: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="Icon name/emoji"
    )
    list_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="custom",
        comment="tasks | checklist | ideas | custom",
    )
    field_schema: Mapped[dict[str, Any]] = mapped_column(
        PortableJSON, nullable=False, default=dict, comment="Custom field definitions"
    )

    # -- timestamps ----------------------------------------------------------------
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

    # -- relationships -------------------------------------------------------------
    items: Mapped[list[ListItem]] = relationship(
        back_populates="list", cascade="all, delete-orphan"
    )

    # -- constraints & indexes -----------------------------------------------------
    __table_args__ = (
        UniqueConstraint(
            "owner_context",
            "owner_user_id",
            "ref_no",
            name="uq_lists_owner_ref",
        ),
        Index("ix_lists_owner_context_user", "owner_context", "owner_user_id"),
        Index("ix_lists_title", "title"),
    )

    def __repr__(self) -> str:
        return (
            f"<List ref_no={self.ref_no} title={self.title!r} "
            f"user={self.owner_user_id!r}>"
        )


class ListItem(UUIDPKMixin, Base):
    """Item within a list — not independently referenceable (no ``ref_no``).

    ``title`` stores the raw form including any tag markup (e.g.
    ``{TASK:5}``).  Tags are resolved at display time by the frontend.
    """

    __tablename__ = "list_items"

    # -- parent list ---------------------------------------------------------------
    list_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(),
        ForeignKey("lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK → lists.id",
    )

    # -- content -------------------------------------------------------------------
    title: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Raw title — may contain tag markup"
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Raw description — may contain tag markup"
    )
    is_done: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="Completion status"
    )
    priority: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True, comment="User priority (lower = more urgent)"
    )
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="Due date in UTC"
    )
    notify_before: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="Seconds before due_at to notify"
    )
    assignee_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), nullable=True, comment="Assignee — unused in v0.1"
    )
    position: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="Sort position within list"
    )

    # -- timestamps ----------------------------------------------------------------
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

    # -- relationships -------------------------------------------------------------
    list: Mapped[List] = relationship(back_populates="items")

    def __repr__(self) -> str:
        return (
            f"<ListItem title={self.title!r} list={self.list_id!r} "
            f"is_done={self.is_done}>"
        )
