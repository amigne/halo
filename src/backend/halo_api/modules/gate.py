"""Gate helpers — guard routes, menus, and tag participation by module state (T-041).

These utilities check the persisted activation state of a module and are
consumed by the core to enforce gating.  They are **defined here but not yet
applied** to any real module — wiring happens in step 7.
"""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from halo_api.core.db import get_session
from halo_api.modules.models import Module as ModuleRow
from halo_api.modules.registry import get_module, is_enabled

# ── API route gate ─────────────────────────────────────────────────────────────


def require_module_enabled(module_key: str) -> Callable[..., object]:
    """Return a FastAPI dependency that raises 404 when *module_key* is disabled.

    Usage (step 7+)::

        router = APIRouter(dependencies=[Depends(require_module_enabled("lists"))])

    The outer function is a **synchronous factory** that captures *module_key*
    and returns an async FastAPI dependency.  When the module is disabled the
    endpoint behaves as if it does not exist (404), not as if it is forbidden
    (403) — this avoids leaking information about installed-but-inactive features.
    """

    async def _check(
        request: Request,
        session: AsyncSession = Depends(get_session),
    ) -> None:
        enabled = await is_enabled(session, module_key)
        if not enabled:
            raise HTTPException(status_code=404, detail="Not found")

    return _check


# ── Menu gate ──────────────────────────────────────────────────────────────────


async def enabled_module_keys(session: AsyncSession) -> set[str]:
    """Return the set of module keys that are currently enabled.

    Consumed by the frontend menu builder (or a dedicated ``/api/v1/modules``
    endpoint) to decide which navigation entries to render.

    A module must be **both** registered **and** enabled in the database to
    appear in the result set.
    """
    result = await session.execute(
        select(ModuleRow.key).where(ModuleRow.enabled.is_(True))
    )
    return set(result.scalars().all())


# ── Tag-prefix gate ────────────────────────────────────────────────────────────


async def active_tag_prefixes(session: AsyncSession) -> set[str]:
    """Return the set of tag prefixes belonging to enabled modules.

    The tag parser uses this to decide which prefixes are "live" — references
    using a prefix from a disabled module are treated as plain text.
    """
    enabled_keys = await enabled_module_keys(session)

    prefixes: set[str] = set()
    for key in enabled_keys:
        mod = get_module(key)
        if mod is not None:
            prefixes.add(mod.tag_prefix)
    return prefixes
