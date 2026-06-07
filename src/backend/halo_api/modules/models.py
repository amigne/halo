"""SQLAlchemy ORM model for the ``modules`` table (T-040).

Only the table definition lives here.  The module registry and activation
logic are introduced in step 1c.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from halo_api.core.db import Base


class Module(Base):
    """Registered module — one row per known module key."""

    __tablename__ = "modules"

    key: Mapped[str] = mapped_column(
        String(64), primary_key=True, comment="Unique module key (e.g. 'lists')"
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    enabled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=None,
        nullable=True,
        comment="UTC timestamp of last enable",
    )
    enabled_by: Mapped[str | None] = mapped_column(
        String(255),
        default=None,
        nullable=True,
        comment="Identifier of the admin who enabled it",
    )
