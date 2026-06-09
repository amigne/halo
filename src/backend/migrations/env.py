"""Alembic environment — async, DATABASE_URL from application settings (T-140)."""

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

# Ensure the backend package is importable (prepend_sys_path in alembic.ini
# points to "." which resolves to src/backend).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import halo_api.accounts.models
import halo_api.modules.models  # noqa: F401 — registers Module in Base.metadata
from halo_api.core.config import settings
from halo_api.core.db import Base

# Alembic Config object
config = context.config

# Set up logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use the shared declarative Base metadata for autogeneration
target_metadata = Base.metadata

# Override sqlalchemy.url from the application config (T-089, T-154)
DATABASE_URL = settings.database_url


def run_migrations_offline() -> None:
    """Offline mode — emit SQL without connecting.

    The URL is set from application settings, not alembic.ini.
    """
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Execute migrations on the given connection (sync wrapper)."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Online mode — run migrations against a live database (async)."""
    connectable = create_async_engine(DATABASE_URL, poolclass=pool.NullPool)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
