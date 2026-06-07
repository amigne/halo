"""Module contract — the frozen Protocol every Halo module must satisfy (T-040..T-044).

This is a **foundation** — all future modules conform to this contract.
It is defined generically, without knowledge of any concrete module.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from fastapi import APIRouter

# ── Reference types ────────────────────────────────────────────────────────────

ContextKey = Literal["personal"]
"""Scope key for reference resolution and title search.

``"personal"`` — the user's own data (the only scope in v0.0.1).
``"group"`` will be added in v0.2.0.
"""


@dataclass(frozen=True)
class RefType:
    """Descriptor for a type of object that can be referenced via tags.

    Each concrete module declares which types it exposes to the tagging
    system through :meth:`Module.referable_types`.
    """

    key: str
    """Machine-readable type identifier within the module (e.g. ``"task"``)."""

    label: str
    """Human-readable singular label (e.g. ``"Task"``)."""


@dataclass(frozen=True)
class RefHit:
    """A single reference resolution or title-search hit.

    Returned by :meth:`Module.resolve_refs` and :meth:`Module.search_titles`.
    """

    tag_prefix: str
    """The tag prefix that triggered this hit (e.g. ``"#"``, ``"@"``)."""

    ref_no: int
    """Human-readable integer identifier, scoped to ``(context, type)``.

    Tags reference objects by their ``ref_no`` — **not** by the internal
    ``UUIDv7`` (which remains a technical implementation detail).
    """

    uuid: UUID
    """Technical primary key (UUIDv7) of the referenced record."""

    title: str
    """Display title for autocomplete and link rendering."""


# ── Module contract ────────────────────────────────────────────────────────────


class Module(ABC):
    """Frozen contract that every Halo module must satisfy (T-040..T-044).

    A **module** is a self-contained feature unit (Lists, Notes, Bookmarks, …)
    that plugs into the core through this contract.  The core never knows about
    concrete modules — it only depends on this ABC.

    Subclasses **must** declare the class-level attributes and implement every
    ``@abstractmethod``.  The ABC cannot be instantiated otherwise.
    """

    # -- identity (class-level, required) -----------------------------------------

    key: str
    """Stable machine-readable slug (e.g. ``"lists"``).  Used in routes, i18n
    keys, and as the primary key in the ``modules`` registry table."""

    tag_prefix: str
    """Single-character prefix for inline tags that reference objects of this
    module (e.g. ``"#"``, ``"@"``).  The prefix is **reserved** per module —
    the gate helpers enforce this exclusivity (step 7)."""

    introduced_in: str
    """Semver string indicating the Halo version that first shipped this module
    (e.g. ``"0.0.1"``).  Used for feature-gating and migration tooling."""

    # -- routing ------------------------------------------------------------------

    router: APIRouter
    """FastAPI router that exposes the module's HTTP endpoints.  Mounted by the
    core under ``/api/v1/{module.key}/`` when the module is enabled."""

    # -- schema contract ----------------------------------------------------------

    @abstractmethod
    def models(self) -> list[type]:
        """Return every SQLAlchemy ORM model owned by this module.

        Used by Alembic's ``target_metadata`` to auto-discover tables for
        migration autogeneration.
        """
        ...

    @abstractmethod
    def referable_types(self) -> list[RefType]:
        """Declare which object types this module exposes to the tagging system.

        Example: the Lists module returns ``[RefType("task", "Task")]``.
        """
        ...

    @abstractmethod
    async def resolve_refs(
        self, ref_nos: list[int], ctx: ContextKey
    ) -> dict[int, RefHit]:
        """Resolve a batch of ``ref_no`` integers to :class:`RefHit` objects.

        Called by the tag parser when rendering inline references.  Must return
        a dict mapping each requested ``ref_no`` to its hit — missing entries
        signal a broken reference (the renderer shows a placeholder).
        """
        ...

    @abstractmethod
    async def search_titles(self, query: str, ctx: ContextKey) -> list[RefHit]:
        """Full-text (or LIKE) search across titles for autocomplete.

        Called as the user types a tag (e.g. ``#proj`` → returns tasks
        whose title matches ``%proj%``).  Results are scoped to *ctx*.
        """
        ...
