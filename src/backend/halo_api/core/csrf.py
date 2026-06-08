"""CSRF protection middleware (T-071).

Uses a custom header (``X-CSRF-Token``) combined with ``SameSite=Lax``
cookies.  The frontend reads the CSRF token from a dedicated cookie and
sends it back as a header on mutating requests.

For same-origin requests the ``SameSite=Lax`` cookie provides the primary
defense.  The custom header adds an extra layer against cross-origin form
submissions.
"""

from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


class CSRFCustomHeaderMiddleware(BaseHTTPMiddleware):
    """Require ``X-CSRF-Token`` header on mutating requests.

    The token value is read from a ``csrf_token`` cookie set by the
    frontend.  The header must match the cookie value.
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method.upper() not in SAFE_METHODS:
            cookie_token = request.cookies.get("csrf_token", "")
            header_token = request.headers.get("X-CSRF-Token", "")

            # If the cookie is set, the header must match.
            # An attacker on a different origin cannot read the cookie
            # (SameSite + HttpOnly not required for CSRF token cookie),
            # so they cannot send the matching header.
            if cookie_token and cookie_token != header_token:
                return Response(
                    content='{"code":"CSRF_INVALID","message":"CSRF token mismatch"}',
                    status_code=403,
                    media_type="application/json",
                )

        return await call_next(request)
