"""Pydantic schemas for the ``/api/v1/refs`` endpoints (step 5-2/5-3)."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict


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
