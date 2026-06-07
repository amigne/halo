"""Test fixtures — dual-engine parametrisation and FastAPI client.

Provides:
- ``db_url`` — parametrised across SQLite and (when reachable) PostgreSQL.
- ``client`` — async HTTPX client (uses the default SQLite DATABASE_URL).
- ``redis_available`` — whether Redis is up.
"""

import os
import subprocess
from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from halo_api.main import app

BACKEND_DIR = Path(__file__).resolve().parent.parent
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"

# ── DB URLs ──────────────────────────────────────────────────────────────────

SQLITE_URL = "sqlite+aiosqlite:///./test_halo.db"
PG_URL = os.environ.get(
    "TEST_PG_URL",
    "postgresql+psycopg://postgres:halotest@localhost:5432/halotest",
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _pg_available() -> bool:
    """Return ``True`` when the test Postgres 18 instance is reachable."""
    try:
        import psycopg

        conn = psycopg.connect(
            "postgresql://postgres:halotest@localhost:5432/halotest",
            connect_timeout=3,
        )
        conn.close()
        return True
    except Exception:
        return False


def _redis_available() -> bool:
    """Return ``True`` when Redis is reachable."""
    try:
        import redis

        r = redis.Redis(host="localhost", port=6379, socket_connect_timeout=2)
        r.ping()
        r.close()
        return True
    except Exception:
        return False


def cleanup_db_file(url: str) -> None:
    """Remove an SQLite database file."""
    if url.startswith("sqlite"):
        path = url.removeprefix("sqlite+aiosqlite:///").lstrip("/")
        if os.path.exists(path):
            os.remove(path)


def run_alembic(
    cmd: list[str], db_url: str
) -> subprocess.CompletedProcess[str]:
    """Run Alembic in a subprocess (avoids event-loop conflicts)."""
    env = os.environ.copy()
    env["DATABASE_URL"] = db_url
    return subprocess.run(
        ["uv", "run", "alembic", "-c", str(ALEMBIC_INI), *cmd],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
    )


# ── Parametrisation ──────────────────────────────────────────────────────────

DB_PARAMS = [("sqlite", SQLITE_URL)]
if _pg_available():
    DB_PARAMS.append(("postgresql", PG_URL))
DB_IDS = [p[0] for p in DB_PARAMS]


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture(params=DB_PARAMS, ids=DB_IDS)
def db_url(request: pytest.FixtureRequest) -> str:
    """Parametrised DB URL — one test run per available database engine."""
    url: str = request.param[1]
    return url


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient]:
    """Async HTTP client for the FastAPI app.

    Uses the default DATABASE_URL (SQLite ``./halo.db`` for dev).
    The test database file is cleaned up after the request.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    # Clean up the default SQLite database created during the test
    from halo_api.core.config import settings

    cleanup_db_file(settings.database_url)


@pytest.fixture
def redis_available() -> bool:
    """``True`` when a live Redis instance is reachable."""
    return _redis_available()
