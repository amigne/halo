"""unique index on user_notification_prefs (user, module, event, channel)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-22 09:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "uq_user_notification_prefs_umec"
_TABLE = "user_notification_prefs"
_COLS = ["user_id", "module_key", "event_type", "channel"]


def upgrade() -> None:
    """Enforce one preference row per (user, module, event, channel).

    A plain unique index is portable across SQLite and Postgres without a
    table rebuild, and makes the lazy upsert in users.py race-safe.
    """
    op.create_index(_INDEX, _TABLE, _COLS, unique=True)


def downgrade() -> None:
    """Drop the unique index."""
    op.drop_index(_INDEX, table_name=_TABLE)
