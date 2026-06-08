"""CSRF protection middleware (T-071).

Double-submit cookie pattern: a ``csrf_token`` cookie (HttpOnly=False,
readable by JS) must be sent back as an ``X-CSRF-Token`` header on every
mutating request targeting ``/api/``.

``SameSite=Lax`` provides the primary defence; the custom header adds an
extra layer against cross-origin form submissions.
"""

import secrets
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
# Endpoints exempt from CSRF (e.g. the CSRF token endpoint itself).
CSRF_EXEMPT_PATHS = {"/api/v1/auth/csrf"}


def generate_csrf_token() -> str:
    """Return a fresh CSPRNG CSRF token."""
    return secrets.token_urlsafe(32)


def set_csrf_cookie(response: Response, token: str, secure: bool) -> None:
    """Emit the ``csrf_token`` cookie on *response*.

    ``HttpOnly=False`` so the frontend can read it via ``document.cookie``
    and send it back as a header.
    """
    response.set_cookie(
        key=CSRF_COOKIE,
        value=token,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
        max_age=86400,  # 24 hours
    )


class CSRFCustomHeaderMiddleware(BaseHTTPMiddleware):
    """Require ``X-CSRF-Token`` header == ``csrf_token`` cookie on mutations.

    - Safe methods (GET/HEAD/OPTIONS/TRACE) are passed through.
    - ``GET /api/v1/auth/csrf`` is always exempt.
    - On mutating requests: if the cookie OR header is missing/mismatched
      → 403 ``{"code":"CSRF_INVALID", ...}``.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.method.upper() in SAFE_METHODS:
            return await call_next(request)

        if request.url.path in CSRF_EXEMPT_PATHS:
            return await call_next(request)

        cookie_token = request.cookies.get(CSRF_COOKIE, "")
        header_token = request.headers.get(CSRF_HEADER, "")

        if not cookie_token or not header_token or cookie_token != header_token:
            return Response(
                content=(
                    '{"code":"CSRF_INVALID","message":"CSRF token missing or mismatch"}'
                ),
                status_code=403,
                media_type="application/json",
            )

        return await call_next(request)
