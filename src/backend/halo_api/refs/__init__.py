"""Ref-counter system — shared by all referenceable modules (specs/03 §4).

``ref_counters`` stores the next available ``ref_no`` per
(owner_context, owner_user_id, group_id, object_type) tuple.
"""

from halo_api.refs.counters import allocate_ref_no
from halo_api.refs.models import RefCounter

__all__ = ["RefCounter", "allocate_ref_no"]
