"""Tests for the Redis sorted-set reminder scheduler (step 6-2).

All tests require a live Redis instance — skipped when unavailable.
"""

import asyncio
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest

from halo_api.core.redis import get_redis
from halo_api.notifications.scheduler import (
    ZSET_KEY,
    cancel_reminder,
    due_reminders,
    schedule_reminder,
)
from tests.conftest import _redis_available


def _skip_if_no_redis() -> None:
    if not _redis_available():
        pytest.skip("Redis not available")


@pytest.fixture(autouse=True)
async def _clean_zset() -> AsyncGenerator[None]:
    """Remove the reminders ZSET before and after each test.

    Resets the shared Redis client to avoid event-loop cross-contamination
    between pytest-asyncio's per-function event loops.
    """
    _skip_if_no_redis()
    import halo_api.core.redis as redis_mod

    # Close any connection from a previous event loop (suppress errors).
    try:
        if redis_mod._redis is not None:
            await redis_mod._redis.aclose()
            redis_mod._redis = None
    except Exception:
        redis_mod._redis = None

    redis = await get_redis()
    await redis.delete(ZSET_KEY)
    yield
    await redis.delete(ZSET_KEY)
    # Close cleanly while our event loop is still alive.
    try:
        if redis_mod._redis is not None:
            await redis_mod._redis.aclose()  # type: ignore[unreachable]
            redis_mod._redis = None
    except Exception:
        redis_mod._redis = None


# ── schedule + due ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_schedule_and_due() -> None:
    """Only reminders whose fire_at_utc ≤ now_utc are returned."""
    redis = await get_redis()
    now = datetime.now(UTC)

    past_1 = now - timedelta(seconds=10)
    past_2 = now - timedelta(seconds=5)
    far_future = now + timedelta(days=365)

    await schedule_reminder(redis, key="rem:past_1", fire_at_utc=past_1)
    await schedule_reminder(redis, key="rem:past_2", fire_at_utc=past_2)
    await schedule_reminder(redis, key="rem:future", fire_at_utc=far_future)

    due = await due_reminders(redis, now)
    assert set(due) == {"rem:past_1", "rem:past_2"}

    # Verify they were removed from the ZSET.
    count = await redis.zcard(ZSET_KEY)
    assert count == 1  # only the future one remains


@pytest.mark.asyncio
async def test_cancel() -> None:
    """cancel_reminder removes a scheduled key."""
    redis = await get_redis()
    now = datetime.now(UTC)

    t = now - timedelta(seconds=5)
    await schedule_reminder(redis, key="rem:keep", fire_at_utc=t)
    await schedule_reminder(redis, key="rem:drop", fire_at_utc=t)

    await cancel_reminder(redis, "rem:drop")

    due = await due_reminders(redis, now)
    assert due == ["rem:keep"]


@pytest.mark.asyncio
async def test_idempotent_schedule() -> None:
    """Scheduling the same key twice updates the score, no duplicate."""
    redis = await get_redis()
    now = datetime.now(UTC)

    t1 = now + timedelta(hours=1)
    t2 = now + timedelta(hours=2)

    await schedule_reminder(redis, key="rem:x", fire_at_utc=t1)
    await schedule_reminder(redis, key="rem:x", fire_at_utc=t2)

    # Only one entry.
    count = await redis.zcard(ZSET_KEY)
    assert count == 1

    # Score reflects the second (later) call.
    score = await redis.zscore(ZSET_KEY, "rem:x")
    assert score == pytest.approx(t2.timestamp())


@pytest.mark.asyncio
async def test_no_double_processing() -> None:
    """Concurrent due_reminders calls never return the same key."""
    redis = await get_redis()
    now = datetime.now(UTC)

    # Schedule 5 past reminders.
    keys = [f"rem:{i}" for i in range(5)]
    for k in keys:
        await schedule_reminder(redis, key=k, fire_at_utc=now - timedelta(seconds=10))

    # Call due_reminders concurrently.
    results = await asyncio.gather(
        due_reminders(redis, now),
        due_reminders(redis, now),
    )

    # Union of both results must equal all 5 keys, with no overlap.
    all_returned = results[0] + results[1]
    assert len(all_returned) == 5, f"expected 5 total, got {all_returned}"
    assert set(all_returned) == set(keys)

    # The ZSET must be empty now.
    count = await redis.zcard(ZSET_KEY)
    assert count == 0
