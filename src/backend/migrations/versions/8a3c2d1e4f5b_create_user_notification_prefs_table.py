"""create user_notification_prefs table

Revision ID: 8a3c2d1e4f5b
Revises: 78a0cf7b54c5
Create Date: 2026-06-09 09:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8a3c2d1e4f5b"
down_revision: str | Sequence[str] | None = "78a0cf7b54c5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema — create user_notification_prefs table."""
    # CREATE TABLE with inline FK and unique constraint works on both
    # SQLite and PostgreSQL without batch mode.
    op.create_table(
        "user_notification_prefs",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("module_key", sa.String(length=64), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column(
            "channel",
            sa.String(length=20),
            nullable=False,
            comment="'in_app' or 'email'",
        ),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "module_key",
            "event_type",
            "channel",
            name="uq_user_notification_prefs",
        ),
    )
    op.create_index(
        op.f("ix_user_notification_prefs_user_id"),
        "user_notification_prefs",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema — drop user_notification_prefs table."""
    op.drop_index(
        op.f("ix_user_notification_prefs_user_id"),
        table_name="user_notification_prefs",
    )
    op.drop_table("user_notification_prefs")
