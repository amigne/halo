#!/bin/sh
set -e

echo "[halo-entrypoint] applying alembic migrations..."
/app/.venv/bin/alembic -c /app/alembic.ini upgrade head

echo "[halo-entrypoint] starting application..."
exec "$@"
