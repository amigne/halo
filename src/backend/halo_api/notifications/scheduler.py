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
local members = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
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


async def due_reminders(redis: Redis, now_utc: datetime) -> list[str]:
    """Return all reminder keys whose fire time is ≤ *now_utc*.

    The matching members are **atomically removed** from the sorted set
    via a Lua script, so no two callers ever receive the same key.
    """
    now_score = now_utc.timestamp()
    result = await redis.eval(_LUA_DUE_REMINDERS, 1, ZSET_KEY, now_score)
    return cast(list[str], result)
