"""create notifications table

Revision ID: a1b2c3d4e5f6
Revises: 2a3b4c5d6e7f
Create Date: 2026-06-21 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "2a3b4c5d6e7f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema — create notifications table."""
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "type",
            sa.String(length=100),
            nullable=False,
            comment="Event type key, e.g. 'list_item_due'",
        ),
        sa.Column(
            "payload",
            sa.JSON(),
            nullable=False,
            comment="Event-specific JSON payload",
        ),
        sa.Column(
            "read_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="UTC timestamp when read",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_notifications_user_id"),
        "notifications",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_notifications_user_id_read_at"),
        "notifications",
        ["user_id", "read_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema — drop notifications table."""
    op.drop_index(op.f("ix_notifications_user_id_read_at"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")
