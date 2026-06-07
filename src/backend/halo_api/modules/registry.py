"""Module registry — discovery, activation, and lifecycle (T-040).

The registry is the bridge between the abstract :class:`~halo_api.modules.base.Module`
contract and the persisted ``modules`` table.  It:

1. **Discovers** modules through an explicit registration list (modules call
   ``register()`` at import time).
2. **Persists** activation state (enabled / disabled) into the ``modules``
   table so it survives restarts.
3. **Exposes** ``is_enabled`` / ``enable`` / ``disable`` primitives consumed
   by the gate helpers (step 7) and the admin UI (step 8+).

The core never imports concrete modules — it only depends on the registry
and the :class:`Module` ABC (T-042/T-045).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from halo_api.modules.base import Module
from halo_api.modules.models import Module as ModuleRow

# ── In-memory module store ─────────────────────────────────────────────────────

_modules: dict[str, Module] = {}
"""All discovered modules, keyed by ``Module.key``.

Populated by :func:`register` — each concrete module calls it at import time.
"""


def register(module: Module) -> None:
    """Register a concrete module instance for discovery.

    Called once per module at import time (e.g. in the module's ``__init__.py``).
    Raises ``ValueError`` if a module with the same ``key`` is already registered.
    """
    if module.key in _modules:
        raise ValueError(
            f"Duplicate module key '{module.key}': "
            f"{type(_modules[module.key]).__name__} already registered"
        )
    _modules[module.key] = module


def list_modules() -> list[Module]:
    """Return every registered module, in registration order."""
    return list(_modules.values())


def get_module(key: str) -> Module | None:
    """Look up a registered module by its stable ``key``."""
    return _modules.get(key)


# ── Persisted activation state ─────────────────────────────────────────────────


async def is_enabled(session: AsyncSession, key: str) -> bool:
    """Return ``True`` when the module *key* is enabled in the database.

    A module that is registered but has never been enabled returns ``False``
    (its ``modules`` row does not exist or has ``enabled=False``).
    """
    row = await session.get(ModuleRow, key)
    return row is not None and row.enabled


async def enable(
    session: AsyncSession,
    key: str,
    enabled_by: uuid.UUID | None = None,
) -> None:
    """Persist an enabled state for module *key*.

    Creates the ``modules`` row if it does not exist yet (idempotent).
    Sets ``enabled_at`` to the current UTC time.
    """
    row = await session.get(ModuleRow, key)
    if row is None:
        row = ModuleRow(key=key)
        session.add(row)
    row.enabled = True
    row.enabled_at = datetime.now(UTC)
    row.enabled_by = enabled_by
    await session.flush()


async def disable(session: AsyncSession, key: str) -> None:
    """Persist a disabled state for module *key*.

    If no row exists yet, one is created with ``enabled=False`` so the
    explicit opt-out is recorded.
    """
    row = await session.get(ModuleRow, key)
    if row is None:
        row = ModuleRow(key=key, enabled=False)
        session.add(row)
    else:
        row.enabled = False
    await session.flush()


async def sync_registry(session: AsyncSession) -> None:
    """Ensure every registered module has a row in the ``modules`` table.

    Missing rows are inserted with ``enabled=False`` (safe default).
    Existing rows are left untouched — sync never re-enables a module
    that was explicitly disabled.
    """
    existing = (await session.execute(select(ModuleRow.key))).scalars().all()
    existing_set = set(existing)

    for key in _modules:
        if key not in existing_set:
            session.add(ModuleRow(key=key, enabled=False))

    await session.flush()
