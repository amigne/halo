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

SQLITE_URL = f"sqlite+aiosqlite:///{BACKEND_DIR}/test_halo.db"
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


def run_alembic(cmd: list[str], db_url: str) -> subprocess.CompletedProcess[str]:
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


@pytest.fixture(params=DB_PARAMS, ids=[f"http-{i}" for i in DB_IDS])
async def http_client(
    request: pytest.FixtureRequest,
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncGenerator[AsyncClient]:
    """Async HTTP client parametrised across DB engines.

    The FastAPI app's engine and session factory are temporarily swapped
    to point to the parametrised test database.  Rate limiting thresholds
    are set very high so HTTP auth tests are not throttled.
    """
    from sqlalchemy.ext.asyncio import (
        AsyncSession as SASession,
    )
    from sqlalchemy.ext.asyncio import (
        async_sessionmaker,
        create_async_engine,
    )

    from halo_api.core import db as db_mod
    from halo_api.core.config import settings as app_settings

    db_url: str = request.param[1]
    cleanup_db_file(db_url)
    # For PostgreSQL, downgrade first to ensure a clean slate between tests.
    run_alembic(["downgrade", "base"], db_url)
    result = run_alembic(["upgrade", "head"], db_url)
    assert result.returncode == 0, (
        f"Alembic upgrade failed for {db_url}:\n{result.stderr}"
    )

    # Save original engine/session so we can restore after the test.
    _orig_engine = db_mod.engine
    _orig_session = db_mod.async_session

    # Swap in a test engine + session factory pointing to the test DB.
    test_engine = create_async_engine(db_url, echo=False)
    test_session = async_sessionmaker(
        test_engine, class_=SASession, expire_on_commit=False
    )
    db_mod.engine = test_engine
    db_mod.async_session = test_session

    # Disable Secure cookie flag in tests (ASGITransport uses http://test).
    monkeypatch.setattr(app_settings, "session_secure_cookie", False)

    # Disable rate limiting for HTTP tests.
    # The rate_limit decorator captures the threshold at import time,
    # so we must replace the inner _check_rate_limit function.
    import halo_api.core.rate_limit as rl_mod

    _orig_check = rl_mod._check_rate_limit

    async def _noop_check(key: str, max_requests: int, window_seconds: int) -> bool:
        return True

    rl_mod._check_rate_limit = _noop_check

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    # Restore original rate limit check, engine, and session.
    rl_mod._check_rate_limit = _orig_check
    await test_engine.dispose()
    db_mod.engine = _orig_engine
    db_mod.async_session = _orig_session

    cleanup_db_file(db_url)


@pytest.fixture(params=DB_PARAMS, ids=[f"rl-{i}" for i in DB_IDS])
async def http_client_rl(
    request: pytest.FixtureRequest,
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncGenerator[AsyncClient]:
    """Like http_client but WITHOUT disabling rate limiting (Redis required)."""
    if not _redis_available():
        pytest.skip("Redis not available")

    from sqlalchemy.ext.asyncio import (
        AsyncSession as SASession,
    )
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from halo_api.core import db as db_mod
    from halo_api.core.config import settings as app_settings

    db_url: str = request.param[1]
    cleanup_db_file(db_url)
    run_alembic(["downgrade", "base"], db_url)
    result = run_alembic(["upgrade", "head"], db_url)
    assert result.returncode == 0, f"Alembic upgrade failed:\n{result.stderr}"

    _orig_engine = db_mod.engine
    _orig_session = db_mod.async_session
    test_engine = create_async_engine(db_url, echo=False)
    db_mod.engine = test_engine
    db_mod.async_session = async_sessionmaker(
        test_engine, class_=SASession, expire_on_commit=False
    )
    monkeypatch.setattr(app_settings, "session_secure_cookie", False)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    await test_engine.dispose()
    db_mod.engine = _orig_engine
    db_mod.async_session = _orig_session
    cleanup_db_file(db_url)


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
