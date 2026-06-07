"""Module contract validation (T-040..T-044).

Verifies that the :class:`~halo_api.modules.base.Module` ABC enforces its
contract and that a dummy module satisfies it.
"""

import pytest

from halo_api.modules.base import ContextKey, Module, RefHit, RefType
from tests.module_dummy import DummyModule

# ── Contract enforcement ───────────────────────────────────────────────────────


class PartialModule(Module):
    """A module that forgets to implement ``models()`` — must fail."""

    key = "partial"
    tag_prefix = "@"
    introduced_in = "0.0.1"
    router = None  # type: ignore[assignment]

    def referable_types(self) -> list[RefType]:
        return []

    async def resolve_refs(
        self, ref_nos: list[int], ctx: ContextKey
    ) -> dict[int, RefHit]:
        return {}

    async def search_titles(self, query: str, ctx: ContextKey) -> list[RefHit]:
        return []

    # ``models()`` is deliberately missing — instantiation must raise TypeError.


def test_missing_abstract_method_prevents_instantiation() -> None:
    """A subclass that omits an @abstractmethod cannot be instantiated."""
    with pytest.raises(TypeError):
        PartialModule()  # type: ignore[abstract]


def test_dummy_module_can_be_instantiated() -> None:
    """A fully-conforming subclass instantiates without error."""
    mod = DummyModule()
    assert isinstance(mod, Module)


# ── Dummy module attributes ────────────────────────────────────────────────────


def test_dummy_module_has_required_attributes() -> None:
    """The dummy module exposes every class-level attr required by the contract."""
    mod = DummyModule()
    assert mod.key == "dummy"
    assert mod.tag_prefix == "#"
    assert mod.introduced_in == "0.0.1"
    assert mod.router is not None


def test_dummy_module_models_returns_list() -> None:
    mod = DummyModule()
    result = mod.models()
    assert isinstance(result, list)


def test_dummy_module_referable_types_returns_ref_types() -> None:
    mod = DummyModule()
    types = mod.referable_types()
    assert len(types) >= 1
    assert all(isinstance(t, RefType) for t in types)
    assert types[0].key == "dummy_item"
    assert types[0].label == "Dummy Item"


@pytest.mark.asyncio
async def test_dummy_module_resolve_refs() -> None:
    mod = DummyModule()
    hits = await mod.resolve_refs([1, 2, 3], "personal")
    assert isinstance(hits, dict)
    assert set(hits.keys()) == {1, 2, 3}
    assert all(isinstance(h, RefHit) for h in hits.values())
    assert hits[1].tag_prefix == "#"
    assert hits[1].ref_no == 1
    assert hits[1].title == "Dummy #1"


@pytest.mark.asyncio
async def test_dummy_module_search_titles() -> None:
    mod = DummyModule()
    hits = await mod.search_titles("test", "personal")
    assert isinstance(hits, list)
    assert len(hits) == 1
    assert isinstance(hits[0], RefHit)
    assert hits[0].title == "Dummy match for 'test'"


# ── RefHit immutability ────────────────────────────────────────────────────────


def test_ref_hit_is_frozen() -> None:
    """RefHit is a frozen dataclass — mutation must raise FrozenInstanceError."""
    import uuid as _uuid

    hit = RefHit(tag_prefix="#", ref_no=1, uuid=_uuid.uuid7(), title="Test")
    with pytest.raises(AttributeError):  # FrozenInstanceError inherits AttributeError
        hit.title = "Changed"  # type: ignore[misc]


def test_ref_type_is_frozen() -> None:
    """RefType is a frozen dataclass."""
    rt = RefType(key="task", label="Task")
    with pytest.raises(AttributeError):
        rt.key = "changed"  # type: ignore[misc]
