"""null_safe_ref_counters_unique

Revision ID: 2a3b4c5d6e7f
Revises: 1653e4ff49b1
Create Date: 2026-06-12 10:00:00.000000

Replace the standard UNIQUE constraint on ref_counters with a NULL-safe
expression index.  Standard UNIQUE constraints treat NULLs as distinct
values, which defeats ``ON CONFLICT`` upsert when ``group_id`` is NULL.

The new index uses ``COALESCE`` to map NULL ``group_id`` to the nil UUID,
ensuring a single counter row per scope tuple regardless of nullability.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "2a3b4c5d6e7f"
down_revision: str | Sequence[str] | None = "1653e4ff49b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Nil UUID used as COALESCE sentinel for NULL group_id.
NIL_UUID = "00000000-0000-0000-0000-000000000000"


def upgrade() -> None:
    # 1. Drop the old constraint that treats NULLs as distinct.
    with op.batch_alter_table("ref_counters") as batch_op:
        batch_op.drop_constraint("uq_ref_counters_scope", type_="unique")

    # 2. Create a NULL-safe unique index.
    #    COALESCE(group_id, <nil>) ensures two rows with group_id=NULL
    #    collide under the unique index instead of being considered distinct.
    op.create_index(
        "uq_ref_counters_scope",
        "ref_counters",
        [
            "owner_context",
            "owner_user_id",
            sa.text(f"COALESCE(group_id, '{NIL_UUID}')"),
            "object_type",
        ],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_ref_counters_scope", table_name="ref_counters")

    with op.batch_alter_table("ref_counters") as batch_op:
        batch_op.create_unique_constraint(
            "uq_ref_counters_scope",
            [
                "owner_context",
                "owner_user_id",
                "group_id",
                "object_type",
            ],
        )
