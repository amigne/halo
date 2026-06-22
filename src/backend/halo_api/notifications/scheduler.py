"""Redis sorted-set reminder scheduler (specs/03 §10 ; T-111).

Schedules reminder keys in a ZSET scored by UTC epoch seconds.
``schedule_reminder`` is idempotent — calling it twice with the same
key simply updates the fire time.  ``due_reminders`` atomically fetches
**and removes** all keys whose score is ≤ *now_utc*, guaranteeing each
reminder is processed exactly once even when multiple workers call it
concurrently.
"""

from datetime import datetime
from typing import cast

from redis.asyncio import Redis

ZSET_KEY = "halo:reminders"

# Lua script: atomically fetch AND remove all members with score ≤ now.
# KEYS[1] = ZSET key, ARGV[1] = now_utc as epoch seconds float.
_LUA_DUE_REMINDERS = """
-- ARGV[2] caps the batch size so `unpack` never exceeds Lua's stack limit
-- (~8000 args) when a large backlog comes due at once. Callers loop until
-- an empty result is returned.
local members = redis.call(
    'ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, tonumber(ARGV[2])
)
if #members > 0 then
    redis.call('ZREM', KEYS[1], unpack(members))
end
return members
"""


async def schedule_reminder(
    redis: Redis,
    *,
    key: str,
    fire_at_utc: datetime,
) -> None:
    """Schedule (or reschedule) a reminder identified by *key*.

    *fire_at_utc* is converted to a UTC epoch float score.  Replaying
    with the same *key* overwrites the previous score — the operation
    is **idempotent**.
    """
    score = fire_at_utc.timestamp()
    await redis.zadd(ZSET_KEY, {key: score})


async def cancel_reminder(redis: Redis, key: str) -> None:
    """Cancel a previously scheduled reminder.

    Safe to call on a non-existent key — does nothing.
    """
    await redis.zrem(ZSET_KEY, key)


#: Max reminders fetched-and-removed per ``due_reminders`` call. Bounds the
#: Lua ``unpack`` and the per-call memory; callers loop until the result is empty.
DUE_BATCH_LIMIT = 500


async def due_reminders(
    redis: Redis, now_utc: datetime, *, limit: int = DUE_BATCH_LIMIT
) -> list[str]:
    """Return up to *limit* reminder keys whose fire time is ≤ *now_utc*.

    The matching members are **atomically removed** from the sorted set via a
    Lua script, so no two callers ever receive the same key. When more than
    *limit* reminders are due, call this repeatedly until it returns an empty
    list (avoids an oversized ``unpack`` on a large backlog).

    *now_utc* must be timezone-aware UTC (a naïve datetime would be scored as
    local time by ``.timestamp()``).
    """
    now_score = now_utc.timestamp()
    result = await redis.eval(_LUA_DUE_REMINDERS, 1, ZSET_KEY, now_score, limit)
    return cast(list[str], result)
