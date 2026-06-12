"""Pydantic v2 request/response schemas for the Lists module (specs/01 §10.1)."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# ── Presets ───────────────────────────────────────────────────────────────────

_FIELD_SCHEMA_PRESETS: dict[str, dict[str, Any]] = {
    "tasks": {
        "fields": [
            {"key": "title", "type": "text", "required": True},
            {"key": "description", "type": "text", "required": False},
            {"key": "priority", "type": "select", "required": False},
            {"key": "due_at", "type": "datetime", "required": False},
            {"key": "notify_before", "type": "number", "required": False},
            {
                "key": "assignee",
                "type": "user",
                "required": False,
                "note": "group only — hidden in personal context",
            },
            {"key": "is_done", "type": "checkbox", "required": False},
        ]
    },
    "checklist": {
        "fields": [
            {"key": "title", "type": "text", "required": True},
            {"key": "is_done", "type": "checkbox", "required": False},
        ]
    },
    "ideas": {
        "fields": [
            {"key": "title", "type": "text", "required": True},
            {"key": "description", "type": "text", "required": False},
        ]
    },
    "custom": {"fields": []},
}


def get_preset_field_schema(list_type: str) -> dict[str, Any]:
    """Return the preset ``field_schema`` for *list_type*."""
    return _FIELD_SCHEMA_PRESETS.get(list_type, _FIELD_SCHEMA_PRESETS["custom"])


# ── Request schemas ───────────────────────────────────────────────────────────


class ListCreate(BaseModel):
    """Payload for creating a list (F-111)."""

    title: str = Field(min_length=1, max_length=500)
    list_type: str = Field(
        default="custom", pattern=r"^(tasks|checklist|ideas|custom)$"
    )
    icon: str | None = Field(default=None, max_length=100)
    field_schema: dict[str, Any] | None = None


class ListUpdate(BaseModel):
    """Partial update for a list (F-113).

    Only the non-None fields are applied.  ``ref_no``, ``list_type`` and
    owner fields are immutable and ignored.
    """

    title: str | None = Field(default=None, min_length=1, max_length=500)
    icon: str | None = Field(default=None, max_length=100)
    field_schema: dict[str, Any] | None = None


# ── Response schemas ──────────────────────────────────────────────────────────


class ListResponse(BaseModel):
    """Public list representation returned by the API."""

    id: uuid.UUID
    ref_no: int
    owner_context: str
    owner_user_id: uuid.UUID
    group_id: uuid.UUID | None
    title: str
    icon: str | None
    list_type: str
    field_schema: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
