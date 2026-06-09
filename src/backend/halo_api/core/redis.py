"""Async Redis client — single shared instance, lazily connected.

Import ``get_redis`` wherever you need a Redis connection.
"""

from redis.asyncio import Redis

from halo_api.core.config import settings

_redis: Redis | None = None


async def get_redis() -> Redis:
    """Return the shared async Redis client, creating it on first call."""
    global _redis
    if _redis is None:
        _redis = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
        )
    return _redis


async def close_redis() -> None:
    """Close the shared Redis client and reset the global reference."""
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


async def check_redis() -> bool:
    """Ping Redis — returns ``True`` when reachable.

    If the first attempt fails, the shared client is reset and a second
    attempt is made (handles stale connections after lifespan restarts).
    """
    try:
        r = await get_redis()
        return await r.ping() is True  # redis-py 8 returns bool from ping()
    except Exception:
        # Connection may be stale — reset and retry once
        global _redis
        if _redis is not None:
            import contextlib

            with contextlib.suppress(Exception):
                await _redis.aclose()
            _redis = None
        try:
            r2 = await get_redis()
            return await r2.ping() is True
        except Exception:
            return False
