"""Dummy module for validating the Module contract in tests.

This module is deliberately minimal — it exists only to prove that the ABC
is enforceable and that the registry can manage it.
"""

import uuid

from fastapi import APIRouter

from halo_api.modules.base import ContextKey, Module, RefHit, RefType


class DummyModule(Module):
    """A minimal, fully-conforming module used in contract validation tests."""

    key = "dummy"
    tag_prefix = "#"
    introduced_in = "0.0.1"
    router = APIRouter()

    def models(self) -> list[type]:
        return []

    def referable_types(self) -> list[RefType]:
        return [RefType(key="dummy_item", label="Dummy Item")]

    async def resolve_refs(
        self, ref_nos: list[int], ctx: ContextKey
    ) -> dict[int, RefHit]:
        return {
            n: RefHit(
                tag_prefix="#",
                ref_no=n,
                uuid=uuid.uuid7(),
                title=f"Dummy #{n}",
            )
            for n in ref_nos
        }

    async def search_titles(self, query: str, ctx: ContextKey) -> list[RefHit]:
        return [
            RefHit(
                tag_prefix="#",
                ref_no=42,
                uuid=uuid.uuid7(),
                title=f"Dummy match for '{query}'",
            )
        ]
