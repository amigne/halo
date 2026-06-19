"""Refs search endpoint — autocomplete for ``{PREFIX:ref_no}`` tags (T-065/T-102).

Implements the filtering rules described in specs/01 §6.2 (F-064..F-066).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from halo_api.accounts.deps import get_current_user
from halo_api.accounts.models import User
from halo_api.core.db import get_session
from halo_api.modules.base import ContextKey, Module
from halo_api.modules.registry import is_enabled, list_modules
from halo_api.refs.schemas import PrefixSuggestion, SearchResponse, SearchResult

router = APIRouter(prefix="/refs", tags=["refs"])


@router.get("/search", response_model=SearchResponse)
async def search_refs(
    q: str = Query(
        default="",
        description=(
            "Text typed after the opening brace ``{``. "
            "Empty → all types; 1 char → matching types + all objects; "
            "≥ 2 chars → objects only (types hidden)."
        ),
    ),
    context: ContextKey = Query(
        default="personal",
        description="Ownership context — only ``personal`` in v0.1.",
    ),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SearchResponse:
    """Autocomplete for ``{PREFIX:ref_no}`` tag insertion (F-064..F-066).

    **Filtering rules** (the *q* parameter is the text *after* ``{``):

    * *q* empty — return every activated module's prefix in *types*;
      *items* is empty (F-064).
    * *q* has 1 character *N* — return types whose prefix starts with
      *N* (case-insensitive) **and** objects from **all** activated modules
      whose title contains *N* (F-065).
    * *q* has ≥ 2 characters — hide *types*, return only objects whose
      title contains *q* (F-066).

    **Security**: only the caller's objects in the given *context* are
    returned (T-084/T-085).  Disabled modules are never queried and their
    prefixes are never suggested.
    """
    # ── Build the set of active prefixes (enabled modules only) ──────────────
    active_prefixes: dict[str, str] = {}  # prefix → module_key
    enabled_modules: list[Module] = []

    for mod in list_modules():
        if await is_enabled(db, mod.key):
            enabled_modules.append(mod)
            active_prefixes[mod.tag_prefix] = mod.key

    types: list[PrefixSuggestion] = []
    items: list[SearchResult] = []

    # ── Types (prefix suggestions) ───────────────────────────────────────────
    # F-064: empty q → all types.  F-065: 1-char q → matching types.
    # F-066: ≥ 2 chars → types hidden (empty list).
    if len(q) <= 1:
        q_upper = q.upper()
        # Sort for deterministic output — registration order is stable but
        # sorting by prefix gives a predictable UI order.
        for prefix in sorted(active_prefixes):
            if prefix.startswith(q_upper):
                types.append(PrefixSuggestion(prefix=prefix))

    if q == "":
        # No objects when query is empty (F-064: only types shown on ``{``).
        return SearchResponse(types=types, items=items)

    # ── Items (matching objects) ─────────────────────────────────────────────
    # F-065: objects from ALL activated modules whose title contains q.
    # F-066: same, but types are hidden (handled above).
    for mod in enabled_modules:
        hits = await mod.search_titles(q, context)
        for hit in hits:
            items.append(
                SearchResult(
                    tag_prefix=hit.tag_prefix,
                    ref_no=hit.ref_no,
                    uuid=hit.uuid,
                    title=hit.title,
                )
            )

    return SearchResponse(types=types, items=items)
