"""Halo Lists module — data models, API routes, and Module contract."""

from halo_api.modules.lists.models import List, ListItem
from halo_api.modules.lists.module import ListsModule
from halo_api.modules.registry import register

# Register the module at import time so the registry discovers it.
register(ListsModule())

__all__ = ["List", "ListItem", "ListsModule"]
