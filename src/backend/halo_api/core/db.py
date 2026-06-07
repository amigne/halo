"""Async SQLAlchemy engine, session factory, and declarative base (T-140, T-142, T-144).

Provides a single ORM layer that works identically on SQLite 3.50.4 and
PostgreSQL 18.  Engine-agnostic abstractions:
- PortableJSON — sa.JSON works on both (TEXT on SQLite, JSONB on Postgres).
- Email columns use plain String with application-level .lower() instead of
  citext (T-142).
"""

from collections.abc import AsyncGenerator

from sqlalchemy import JSON, event, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from halo_api.core.config import settings

# ── Engine ────────────────────────────────────────────────────────────────────

engine = create_async_engine(
    settings.database_url,
    echo=False,
)

# ── SQLite pragmas (T-144) ───────────────────────────────────────────────────


def _set_sqlite_pragmas(
    dbapi_connection: object, _connection_record: object
) -> None:
    """Set SQLite pragmas on every new connection (T-144).

    Works for both:
    - Raw ``sqlite3.Connection`` (sync engine / pysqlite).
    - ``AsyncAdapt_aiosqlite_connection`` (async engine / aiosqlite).

    PostgreSQL connections are detected and skipped early — executing
    PRAGMA on Postgres aborts the transaction.
    """
    import sqlite3

    # -- unwrap aiosqlite adapter ------------------------------------------------
    # AsyncAdapt_aiosqlite_connection wraps aiosqlite.Connection which
    # holds the real sqlite3.Connection in its ``_conn`` attribute.
    sqlite_conn: sqlite3.Connection | None = None

    if isinstance(dbapi_connection, sqlite3.Connection):
        sqlite_conn = dbapi_connection
    else:
        aiosqlite_conn = getattr(dbapi_connection, "_connection", None)
        if aiosqlite_conn is not None:
            sqlite_conn = getattr(aiosqlite_conn, "_conn", None)

    if sqlite_conn is None:
        return  # Not SQLite — nothing to do.

    # -- apply pragmas ----------------------------------------------------------
    sqlite_conn.execute("PRAGMA journal_mode=WAL")
    sqlite_conn.execute("PRAGMA foreign_keys=ON")
    sqlite_conn.execute("PRAGMA busy_timeout=5000")


event.listen(engine.pool, "connect", _set_sqlite_pragmas)
event.listen(engine.sync_engine, "connect", _set_sqlite_pragmas)

# ── Session ──────────────────────────────────────────────────────────────────

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession]:
    """FastAPI dependency that yields an async DB session.

    Usage::

        from fastapi import Depends
        from halo_api.core.db import get_session

        @router.get("/items")
        async def list_items(session: AsyncSession = Depends(get_session)): ...
    """
    async with async_session() as session:
        yield session


# ── Base ─────────────────────────────────────────────────────────────────────


class Base(DeclarativeBase):
    """Declarative base for all ORM models (SQLAlchemy 2.0 style)."""


# ── Portable types (T-142) ───────────────────────────────────────────────────

# ``sa.JSON`` stores as JSONB on Postgres and as TEXT on SQLite — portable.
PortableJSON = JSON


# ── Health-check helper ──────────────────────────────────────────────────────


async def check_db() -> bool:
    """Ping the database — returns ``True`` when reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
