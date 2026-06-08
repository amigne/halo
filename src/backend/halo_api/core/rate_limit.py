"""Rate limiting via Redis (T-086).

Provides a ``rate_limit`` FastAPI dependency factory that counts requests
keyed by client IP + endpoint name.  Raises HTTP 429 when the limit is
exceeded.

When Redis is unavailable the rate limiter **fails open** (allows the request
through) — this avoids blocking legitimate traffic during Redis outages.

Behind a trusted reverse proxy, the client IP is derived from the first entry
in ``X-Forwarded-For`` instead of ``request.client.host`` (T-086).
"""

import logging
from collections.abc import Callable

from fastapi import HTTPException, Request

from halo_api.core.config import settings
from halo_api.core.redis import get_redis

logger = logging.getLogger("halo.rate_limit")


def _get_client_ip(request: Request) -> str:
    """Return the effective client IP, honouring ``X-Forwarded-For``.

    When ``settings.trusted_proxies`` is set and the direct client is a
    trusted proxy, the first entry in ``X-Forwarded-For`` is used.
    Otherwise ``request.client.host`` is returned as-is.
    """
    direct_ip = request.client.host if request.client else "unknown"

    trusted = {ip.strip() for ip in settings.trusted_proxies.split(",") if ip.strip()}
    if not trusted or direct_ip not in trusted:
        return direct_ip

    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        # X-Forwarded-For: client, proxy1, proxy2, ...
        return forwarded.split(",")[0].strip()

    return direct_ip


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
    max_requests: int,
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

    Args:
        max_requests: Maximum number of requests allowed in the window.
        window_seconds: Duration of the rate limit window in seconds.
        prefix: Key prefix for Redis (e.g. "login", "register").
    """

    async def _rate_limit_dep(request: Request) -> None:
        ip = _get_client_ip(request)
        key = f"ratelimit:{prefix}:{ip}"
        allowed = await _check_rate_limit(key, max_requests, window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={"code": "RATE_LIMITED", "message": "Too many requests"},
            )

    return _rate_limit_dep
