"""ListsModule — implements the Module contract for the Lists feature (T-040..T-044).

Exposes lists to the tag system (``{LIST:ref_no}``) and provides
title search for autocomplete.  Only the list itself is referenceable,
not individual items (F-117).
"""

import logging

import sqlalchemy as sa

from halo_api.core.context import (
    get_current_session_from_context,
    get_current_user_from_context,
)
from halo_api.modules.base import ContextKey, Module, RefHit, RefType
from halo_api.modules.lists.models import List, ListItem
from halo_api.modules.lists.router import router as lists_router

logger = logging.getLogger("halo.lists.module")


class ListsModule(Module):
    """Halo Lists — user-owned lists with items, exposed to the tag system.

    Implements the frozen :class:`Module` contract so the core can discover
    routes, ORM models, and participate in tag resolution (``{LIST:ref_no}``)
    and autocomplete search.
    """

    # -- identity ----------------------------------------------------------------
    key = "lists"
    tag_prefix = "LIST"
    introduced_in = "0.1.0"

    # -- routing -----------------------------------------------------------------
    router = lists_router

    # -- schema contract ---------------------------------------------------------

    def models(self) -> list[type]:
        """Expose ORM models for Alembic auto-discovery."""
        return [List, ListItem]

    def referable_types(self) -> list[RefType]:
        """Only List objects (not items) are referenceable via {LIST:N} tags."""
        return [RefType(key="list", label="List")]

    async def resolve_refs(
        self, ref_nos: list[int], ctx: ContextKey
    ) -> dict[int, RefHit]:
        """Resolve a batch of ``{LIST:N}`` references to :class:`RefHit` objects.

        Only lists owned by the current user in the given *ctx* are returned.
        Missing or inaccessible ref_nos are silently absent from the result dict
        (the renderer shows a placeholder for broken references).
        """
        user = get_current_user_from_context()
        session = get_current_session_from_context()

        if user is None or session is None:
            logger.warning(
                "resolve_refs called outside request context (no user/session)"
            )
            return {}

        result = await session.execute(
            sa.select(List).where(
                List.owner_context == ctx,
                List.owner_user_id == user.id,
                List.ref_no.in_(ref_nos),
            )
        )
        rows = result.scalars().all()

        return {
            row.ref_no: RefHit(
                tag_prefix=self.tag_prefix,
                ref_no=row.ref_no,
                uuid=row.id,
                title=row.title,
            )
            for row in rows
        }

    async def search_titles(self, query: str, ctx: ContextKey) -> list[RefHit]:
        """Case-insensitive substring search across list titles.

        Results are scoped to the current user in the given *ctx*.
        Used for autocomplete as the user types a tag reference.
        """
        user = get_current_user_from_context()
        session = get_current_session_from_context()

        if user is None or session is None:
            logger.warning(
                "search_titles called outside request context (no user/session)"
            )
            return []

        # Escape LIKE wildcards so the user's literal input is matched as-is.
        escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        result = await session.execute(
            sa.select(List).where(
                List.owner_context == ctx,
                List.owner_user_id == user.id,
                List.title.ilike(pattern, escape="\\"),
            )
        )
        rows = result.scalars().all()

        return [
            RefHit(
                tag_prefix=self.tag_prefix,
                ref_no=row.ref_no,
                uuid=row.id,
                title=row.title,
            )
            for row in rows
        ]

    # -- i18n --------------------------------------------------------------------

    def get_label(self, locale: str) -> str:
        """Return the human-readable module label for the given locale.

        Used by the menu / module registry to display translated names.
        """
        if locale == "fr":
            return "Listes"
        return "Lists"
