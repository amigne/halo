"""SQLAlchemy ORM model for the ``modules`` table (T-040).

Only the table definition lives here.  The module registry and activation
logic are introduced in step 1c.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from halo_api.core.db import Base


class Module(Base):
    """Registered module — one row per known module key.

    ``modules`` is a **technical registry** (configuration), not a user-facing
    record — it deliberately uses a **natural primary key** (``key``) instead
    of ``UUIDPKMixin``.  See specs/03 §5 for the rationale.
    """

    __tablename__ = "modules"

    # -- primary key: stable code identifier (routes, i18n keys, tag prefix) ------
    # This is the documented **exception** to the UUIDv7 convention: ``key`` is
    # the module's machine-readable slug, NOT a uuid and NOT a display label
    # (the human-readable name comes from i18n).
    key: Mapped[str] = mapped_column(
        String(64), primary_key=True, comment="Stable module slug (e.g. 'lists')"
    )

    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    enabled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=None,
        nullable=True,
        comment="UTC timestamp of last enable",
    )

    # -- FK → users.id (future) ---------------------------------------------------
    # The ``users`` table does not exist yet (created in v0.0.2 / step 2).
    # When it lands, add a ForeignKey("users.id") constraint.  Until then the
    # column is a plain uuid with no referential integrity check.
    enabled_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(),
        default=None,
        nullable=True,
        comment="FK → users.id — admin who enabled the module (future constraint)",
    )
