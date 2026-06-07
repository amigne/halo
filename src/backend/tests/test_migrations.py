"""Migration tests — upgrade and downgrade on SQLite and PostgreSQL (T-145)."""

import pytest

from tests.conftest import cleanup_db_file, run_alembic


@pytest.mark.asyncio
async def test_upgrade_head_succeeds(db_url: str) -> None:
    """``alembic upgrade head`` must exit 0 on every engine."""
    cleanup_db_file(db_url)
    result = run_alembic(["upgrade", "head"], db_url)
    assert result.returncode == 0, (
        f"upgrade failed on {db_url}\nSTDERR:\n{result.stderr}"
    )


@pytest.mark.asyncio
async def test_downgrade_base_succeeds(db_url: str) -> None:
    """``alembic downgrade base`` must exit 0 on every engine."""
    # Ensure the migration is applied first
    run_alembic(["upgrade", "head"], db_url)
    result = run_alembic(["downgrade", "base"], db_url)
    assert result.returncode == 0, (
        f"downgrade failed on {db_url}\nSTDERR:\n{result.stderr}"
    )
    cleanup_db_file(db_url)


@pytest.mark.asyncio
async def test_upgrade_downgrade_cycle_is_idempotent(db_url: str) -> None:
    """Upgrading, downgrading, then upgrading again must succeed."""
    cleanup_db_file(db_url)
    # First cycle
    assert run_alembic(["upgrade", "head"], db_url).returncode == 0
    assert run_alembic(["downgrade", "base"], db_url).returncode == 0
    # Second cycle — must be clean
    assert run_alembic(["upgrade", "head"], db_url).returncode == 0
    assert run_alembic(["downgrade", "base"], db_url).returncode == 0
    cleanup_db_file(db_url)
