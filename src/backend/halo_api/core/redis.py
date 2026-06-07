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


async def check_redis() -> bool:
    """Ping Redis — returns ``True`` when reachable."""
    try:
        r = await get_redis()
        return await r.ping() is True  # redis-py 8 returns bool from ping()
    except Exception:
        return False
