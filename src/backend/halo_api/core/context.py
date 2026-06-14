"""Request-scoped context variables for the current user and DB session.

ContextVars are automatically isolated per asyncio Task — each HTTP request
gets its own Task in FastAPI/Starlette, so there is no risk of cross-request
leakage.  Explicit reset is unnecessary; the Task cleanup discards the
context when the request ends.

Set by the FastAPI dependency chain (``get_session`` → ``get_current_user``)
and consumed by :class:`~halo_api.modules.base.Module` implementations that
need the caller identity without threading extra parameters through the
contract signatures.
"""

from __future__ import annotations

from contextvars import ContextVar
from typing import TYPE_CHECKING, Any, cast

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from halo_api.accounts.models import User

# ── Context variables ─────────────────────────────────────────────────────────
# Typed as ``Any`` to avoid a circular import: ``accounts.models`` imports from
# ``core.db``, and ``core.__init__`` imports this module.  The real types are
# documented in the accessor return types (guarded by ``TYPE_CHECKING``).

current_user_cv: ContextVar[Any] = ContextVar("current_user", default=None)
"""Currently authenticated user, set by ``get_current_user`` dependency."""

current_session_cv: ContextVar[Any] = ContextVar("current_session", default=None)
"""Current async DB session, set by ``get_session`` dependency."""


# ── Convenience accessors ─────────────────────────────────────────────────────


def get_current_user_from_context() -> User | None:
    """Return the current user from the request-scoped ContextVar."""
    return cast("User | None", current_user_cv.get())


def get_current_session_from_context() -> AsyncSession | None:
    """Return the current DB session from the request-scoped ContextVar."""
    return cast("AsyncSession | None", current_session_cv.get())
