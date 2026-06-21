"""Ref-counter system — shared by all referenceable modules (specs/03 §4).

``ref_counters`` stores the next available ``ref_no`` per
(owner_context, owner_user_id, group_id, object_type) tuple.

Tag grammar and parsing (specs/03 §9) are provided by :mod:`~halo_api.refs.grammar`.
The autocomplete search endpoint (T-065/T-102) is provided by
:mod:`~halo_api.refs.router`.
"""

from halo_api.refs.counters import allocate_ref_no
from halo_api.refs.grammar import TAG_RE, is_valid_prefix, iter_unique_refs, parse_tags
from halo_api.refs.models import RefCounter
from halo_api.refs.schemas import (
    PrefixSuggestion,
    RefEntry,
    ResolveRequest,
    ResolveResponse,
    ResolveResult,
    SearchResponse,
    SearchResult,
)

__all__ = [
    "TAG_RE",
    "PrefixSuggestion",
    "RefCounter",
    "RefEntry",
    "ResolveRequest",
    "ResolveResponse",
    "ResolveResult",
    "SearchResponse",
    "SearchResult",
    "allocate_ref_no",
    "is_valid_prefix",
    "iter_unique_refs",
    "parse_tags",
]
