"""Pydantic schemas for the ``/api/v1/refs`` endpoints (step 5-2/5-3)."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PrefixSuggestion(BaseModel):
    """A tag type (prefix) proposed by the autocomplete menu.

    Example: ``{"prefix": "LIST"}`` renders as ``{LIST`` in the UI,
    inviting the user to continue typing a ref_no.
    """

    model_config = ConfigDict(json_schema_extra={"example": {"prefix": "LIST"}})

    prefix: str


class SearchResult(BaseModel):
    """A single matching referable object returned by the search endpoint.

    Mirrors :class:`~halo_api.modules.base.RefHit` as a JSON-safe schema.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tag_prefix": "LIST",
                "ref_no": 3,
                "uuid": "018f3a92-7c1f-7b8e-9d2a-4e5f6a7b8c9d",
                "title": "Courses hebdomadaires",
            }
        }
    )

    tag_prefix: str
    ref_no: int
    uuid: uuid.UUID
    title: str


class SearchResponse(BaseModel):
    """Full autocomplete response for ``GET /api/v1/refs/search``.

    *types* lists the tag prefixes the user can complete (e.g. ``LIST``,
    ``NOTE``).  *items* lists the matching referable objects from every
    activated module in the current context.

    When the query is empty only *types* is populated (F-064).
    When the query has ≥ 2 characters only *items* is populated (F-066).
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "types": [{"prefix": "LIST"}, {"prefix": "NOTE"}],
                "items": [
                    {
                        "tag_prefix": "LIST",
                        "ref_no": 1,
                        "uuid": "018f3a92-7c1f-7b8e-9d2a-4e5f6a7b8c9d",
                        "title": "Courses",
                    }
                ],
            }
        }
    )

    types: list[PrefixSuggestion]
    items: list[SearchResult]


# ── Resolve (POST /api/v1/refs/resolve) ──────────────────────────────────────


class RefEntry(BaseModel):
    """A single tag reference to resolve.

    Mirrors the raw ``{PREFIX:ref_no}`` form parsed by :mod:`~halo_api.refs.grammar`.
    """

    model_config = ConfigDict(
        json_schema_extra={"example": {"tag_prefix": "LIST", "ref_no": 3}}
    )

    tag_prefix: str = Field(description="Uppercase module prefix, e.g. ``LIST``")
    ref_no: int = Field(ge=1, description="Human-readable reference number")


class ResolveRequest(BaseModel):
    """Request body for ``POST /api/v1/refs/resolve``."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "refs": [
                    {"tag_prefix": "LIST", "ref_no": 1},
                    {"tag_prefix": "NOTE", "ref_no": 5},
                ],
                "context": "personal",
            }
        }
    )

    refs: list[RefEntry] = Field(
        min_length=1, description="Tags to resolve (order is preserved in response)"
    )
    context: Literal["personal"] = Field(
        default="personal",
        description="Ownership context — only ``personal`` in v0.1.",
    )


class ResolveResult(BaseModel):
    """Resolution outcome for a single tag reference.

    When *exists* is ``False`` both *title* and *uuid* are ``null``
    (deny-by-default — no information leakage, T-084/T-085).
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tag_prefix": "LIST",
                "ref_no": 3,
                "title": "Courses hebdomadaires",
                "uuid": "018f3a92-7c1f-7b8e-9d2a-4e5f6a7b8c9d",
                "exists": True,
            }
        }
    )

    tag_prefix: str
    ref_no: int
    title: str | None
    uuid: uuid.UUID | None
    exists: bool


class ResolveResponse(BaseModel):
    """Response for ``POST /api/v1/refs/resolve``.

    Results appear in the **same order** as the request entries so the
    frontend can map each outcome back to its originating tag.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "results": [
                    {
                        "tag_prefix": "LIST",
                        "ref_no": 1,
                        "title": "Courses",
                        "uuid": "018f3a92-7c1f-7b8e-9d2a-4e5f6a7b8c9d",
                        "exists": True,
                    },
                    {
                        "tag_prefix": "NOTE",
                        "ref_no": 99,
                        "title": None,
                        "uuid": None,
                        "exists": False,
                    },
                ]
            }
        }
    )

    results: list[ResolveResult]
