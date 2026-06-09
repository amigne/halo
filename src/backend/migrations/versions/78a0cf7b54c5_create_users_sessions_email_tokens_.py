"""create users sessions email_tokens tables

Revision ID: 78a0cf7b54c5
Revises: 25b253532399
Create Date: 2026-06-08 13:48:24.950187

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "78a0cf7b54c5"
down_revision: str | Sequence[str] | None = "25b253532399"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema — create users, sessions, email_tokens + FK on modules."""
    op.create_table(
        "users",
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column(
            "is_blocked",
            sa.Boolean(),
            nullable=False,
            comment="Created for v0.0.2, functionally unused until v0.2.0",
        ),
        sa.Column("locale", sa.String(length=5), nullable=False),
        sa.Column("theme", sa.String(length=10), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_table(
        "email_tokens",
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column(
            "purpose",
            sa.String(length=20),
            nullable=False,
            comment="'verify' or 'reset'",
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_email_tokens_user_id"), "email_tokens", ["user_id"], unique=False
    )
    op.create_table(
        "sessions",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("ua", sa.String(length=512), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_sessions_user_id"), "sessions", ["user_id"], unique=False)

    # Add FK constraint on modules.enabled_by → users.id (T-041)
    # The enabled_by column was created in migration 25b253532399 as a plain
    # UUID column.  Now that users exists, add the referential constraint.
    # Use batch mode for SQLite compatibility (batch is a no-op on Postgres).
    with op.batch_alter_table("modules") as batch_op:
        batch_op.create_foreign_key(
            "fk_modules_enabled_by_users",
            "users",
            ["enabled_by"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    """Downgrade schema — drop FK on modules, then drop tables."""
    with op.batch_alter_table("modules") as batch_op:
        batch_op.drop_constraint("fk_modules_enabled_by_users", type_="foreignkey")
    op.drop_index(op.f("ix_sessions_user_id"), table_name="sessions")
    op.drop_table("sessions")
    op.drop_index(op.f("ix_email_tokens_user_id"), table_name="email_tokens")
    op.drop_table("email_tokens")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
