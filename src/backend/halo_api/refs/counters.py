"""Atomic ``ref_no`` allocator — generic, monotonic, never-reuse (specs/03 §5).

Provides ``allocate_ref_no``, the single function that every referenceable
module calls to obtain the next human-readable ``ref_no`` for a given
``(owner_context, owner_user_id, group_id, object_type)`` tuple.

Atomicity guarantee
-------------------
- **PostgreSQL**: single ``INSERT ... ON CONFLICT (...) DO UPDATE ...
  RETURNING`` — the expression-backed unique index
  (``COALESCE(group_id, nil)``) makes the upsert work for nullable columns.
- **SQLite**: ``INSERT OR IGNORE`` + ``UPDATE ... RETURNING`` inside the
  caller's transaction.  The expression-backed unique index handles NULL
  ``group_id``, and SQLite serialises writes at the database level.
"""

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Nil UUID sentinel used by the COALESCE-based unique index to treat
# NULL ``group_id`` as a known value (otherwise standard UNIQUE
# constraints consider two NULLs as distinct, defeating upsert).
_NIL_UUID_STR = "00000000-0000-0000-0000-000000000000"


def _uuid_for_db(value: uuid.UUID | None, *, sqlite: bool) -> str | None:
    """Serialise a UUID for the target database dialect.

    - PostgreSQL: native ``uuid`` type — pass the Python ``uuid.UUID``.
    - SQLite: ``CHAR(32)`` via ``sa.Uuid`` — pass the ``.hex`` string
      (32 lowercase hex chars, no dashes).
    """
    if value is None:
        return None
    return value.hex if sqlite else str(value)


async def allocate_ref_no(
    db: AsyncSession,
    *,
    owner_context: str,
    owner_user_id: uuid.UUID | None,
    object_type: str,
    group_id: uuid.UUID | None = None,
) -> int:
    """Reserve and return the next ``ref_no`` (≥ 1) for the given scope key.

    Atomic: transactional increment of a ``ref_counters`` row (created
    on-the-fly when absent).  Never reuses a previously-allocated number.
    """
    bind = db.get_bind()
    is_sqlite = bind is not None and bind.dialect.name == "sqlite"

    params = {
        "id": _uuid_for_db(uuid.uuid7(), sqlite=is_sqlite),
        "owner_context": owner_context,
        "owner_user_id": _uuid_for_db(owner_user_id, sqlite=is_sqlite),
        "group_id": _uuid_for_db(group_id, sqlite=is_sqlite),
        "object_type": object_type,
    }

    if not is_sqlite:
        # PostgreSQL — single atomic upsert.
        # The expression-backed unique index uses COALESCE to treat
        # NULL group_id as the nil UUID.  ON CONFLICT must reference
        # the same expression with parenthesised syntax.
        # NOTE: the COALESCE literal must match the index definition
        # exactly (string literal, not a bind parameter) so that
        # PostgreSQL can infer the correct unique index.
        stmt = text(
            f"""\
            INSERT INTO ref_counters
                (id, owner_context, owner_user_id, group_id, object_type, next_value)
            VALUES
                (:id, :owner_context, :owner_user_id, :group_id, :object_type, 2)
            ON CONFLICT (
                owner_context, owner_user_id,
                (COALESCE(group_id, '{_NIL_UUID_STR}')),
                object_type
            )
            DO UPDATE SET next_value = ref_counters.next_value + 1
            RETURNING next_value\
            """
        )
        result = await db.execute(stmt, params)
    else:
        # SQLite — two-step inside the caller's transaction.
        _cols = "id, owner_context, owner_user_id, group_id, object_type, next_value"
        await db.execute(
            text(
                f"INSERT OR IGNORE INTO ref_counters ({_cols}) "
                "VALUES (:id, :owner_context, :owner_user_id, :group_id, "
                ":object_type, 1)"
            ),
            params,
        )
        result = await db.execute(
            text(
                """\
                UPDATE ref_counters
                SET next_value = next_value + 1
                WHERE owner_context = :owner_context
                  AND owner_user_id IS NOT DISTINCT FROM :owner_user_id
                  AND group_id IS NOT DISTINCT FROM :group_id
                  AND object_type = :object_type
                RETURNING next_value\
                """
            ),
            params,
        )

    row = result.fetchone()
    if row is None:
        raise RuntimeError(
            f"Failed to allocate ref_no for "
            f"ctx={owner_context!r} user={owner_user_id!r} "
            f"group={group_id!r} type={object_type!r}"
        )
    # ``next_value`` was incremented from N to N+1; the allocated number is N.
    next_value: int = row[0]
    return next_value - 1
