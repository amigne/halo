"""Tests for the /ready readiness probe (T-181)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ready_db_ok(client: AsyncClient, redis_available: bool) -> None:
    """GET /api/v1/ready returns 200 when DB is up; Redis status varies."""
    response = await client.get("/api/v1/ready")
    data = response.json()

    assert data["database"] is True

    if redis_available:
        assert response.status_code == 200
        assert data["status"] == "ok"
        assert data["redis"] is True
    else:
        assert response.status_code == 503
        assert data["status"] == "error"
        assert data["redis"] is False


@pytest.mark.asyncio
async def test_ready_response_shape(client: AsyncClient) -> None:
    """The /ready response always contains the expected keys."""
    response = await client.get("/api/v1/ready")
    data = response.json()
    assert set(data.keys()) == {"status", "database", "redis"}
    assert isinstance(data["database"], bool)
    assert isinstance(data["redis"], bool)
    assert data["status"] in ("ok", "error")
