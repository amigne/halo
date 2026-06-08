"""Rate limiting via Redis (T-086).

Provides a ``rate_limit`` FastAPI dependency factory that counts requests
keyed by client IP + endpoint name.  Raises HTTP 429 when the limit is
exceeded.

When Redis is unavailable the rate limiter **fails open** (allows the request
through) — this avoids blocking legitimate traffic during Redis outages.
"""

import logging
from collections.abc import Callable

from fastapi import HTTPException, Request

from halo_api.core.redis import get_redis

logger = logging.getLogger("halo.rate_limit")


async def _check_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int,
) -> bool:
    """Return ``True`` if the request is allowed, ``False`` if rate-limited.

    Uses a simple fixed-window approach via a Redis counter with TTL.
    Fails open (returns ``True``) when Redis is unreachable.
    """
    try:
        redis = await get_redis()
        current = await redis.get(key)
    except Exception:
        logger.warning("Redis unavailable — rate limit check skipped for %s", key)
        return True

    if current is None:
        # First request in the window — start the counter.
        await redis.set(key, 1, ex=window_seconds)
        return True

    count = int(current)
    if count >= max_requests:
        return False

    await redis.incr(key)
    return True


def rate_limit(
    max_requests: int | Callable[[], int],
    window_seconds: int,
    prefix: str = "rate",
) -> Callable[..., object]:
    """Factory returning a FastAPI dependency that enforces rate limiting.

    Usage::

        @router.post("/login")
        async def login(
            request: Request,
            _rate: None = Depends(rate_limit(5, 60, "login")),
        ): ...

    *max_requests* can be an ``int`` or a zero-argument callable returning an
    ``int``.  The callable form reads the limit dynamically at request time
    (useful for testability via Settings monkeypatching).

    Args:
        max_requests: Maximum requests allowed in the window (or callable).
        window_seconds: Duration of the rate limit window in seconds.
        prefix: Key prefix for Redis (e.g. "login", "register").
    """

    async def _rate_limit_dep(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        key = f"ratelimit:{prefix}:{ip}"
        limit = max_requests() if callable(max_requests) else max_requests
        allowed = await _check_rate_limit(key, limit, window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={"code": "RATE_LIMITED", "message": "Too many requests"},
            )

    return _rate_limit_dep
