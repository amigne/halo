"""Lists CRUD API endpoints (specs/01 §10.1 F-111..F-114).

Personal-context only in v0.1 — every endpoint scopes by
``owner_user_id`` and returns 404 (not 403) for cross-user access.
"""

import logging
import uuid

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from halo_api.accounts.deps import get_current_user
from halo_api.accounts.models import User
from halo_api.core.db import get_session
from halo_api.modules.lists.models import List, ListItem
from halo_api.modules.lists.schemas import (
    ListCreate,
    ListItemCreate,
    ListItemResponse,
    ListItemUpdate,
    ListResponse,
    ListUpdate,
    get_preset_field_schema,
)
from halo_api.refs.counters import allocate_ref_no

logger = logging.getLogger("halo.lists")

router = APIRouter(prefix="/modules/lists", tags=["lists"])


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _get_owned_list(
    list_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> List:
    """Fetch a list by UUID, raising 404 if not found or not owned."""
    result = await db.execute(sa.select(List).where(List.id == list_id))
    lst = result.scalar_one_or_none()

    if lst is None or lst.owner_user_id != user.id:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "List not found"},
        )

    return lst


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("", response_model=ListResponse, status_code=201)
async def create_list(
    body: ListCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ListResponse:
    """Create a new list with atomic ``ref_no`` allocation (F-111).

    ``ref_no`` is allocated atomically via ``allocate_ref_no`` in the
    same transaction as the INSERT.  When *field_schema* is omitted the
    preset for *list_type* is applied.
    """
    field_schema = (
        body.field_schema
        if body.field_schema is not None
        else get_preset_field_schema(body.list_type)
    )

    ref_no = await allocate_ref_no(
        db,
        owner_context="personal",
        owner_user_id=user.id,
        object_type="lists",
    )

    lst = List(
        ref_no=ref_no,
        owner_context="personal",
        owner_user_id=user.id,
        title=body.title.strip(),
        icon=body.icon,
        list_type=body.list_type,
        field_schema=field_schema,
    )
    db.add(lst)
    await db.commit()
    await db.refresh(lst)

    logger.info(
        "List created: ref_no=%d title=%r user=%s",
        ref_no,
        body.title,
        user.id,
    )
    return ListResponse.model_validate(lst)


@router.get("", response_model=list[ListResponse])
async def list_lists(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[ListResponse]:
    """Return all lists owned by the current user (F-112)."""
    result = await db.execute(
        sa.select(List)
        .where(
            List.owner_user_id == user.id,
            List.owner_context == "personal",
        )
        .order_by(List.ref_no)
    )
    lists = result.scalars().all()
    return [ListResponse.model_validate(lst) for lst in lists]


@router.get("/{list_id}", response_model=ListResponse)
async def get_list(
    list_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ListResponse:
    """Return a single list owned by the current user (F-112).

    Returns 404 (not 403) when the list belongs to another user —
    information hiding.
    """
    lst = await _get_owned_list(list_id, user, db)
    return ListResponse.model_validate(lst)


@router.patch("/{list_id}", response_model=ListResponse)
async def update_list(
    list_id: uuid.UUID,
    body: ListUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ListResponse:
    """Partially update a list (F-113).

    All fields present in the request body are applied, **including**
    those explicitly set to ``null`` (which clears the field).
    ``ref_no``, ``list_type``, and owner fields are **never** modified.
    """
    lst = await _get_owned_list(list_id, user, db)
    updates = body.model_dump(exclude_unset=True)

    for field, value in updates.items():
        if field in ("title", "icon", "field_schema"):
            if field == "title" and value is not None:
                setattr(lst, field, value.strip())
            elif field == "field_schema" and value is None:
                # field_schema is non-nullable — skip explicit null
                pass
            else:
                setattr(lst, field, value)

    await db.commit()
    await db.refresh(lst)

    return ListResponse.model_validate(lst)


@router.delete("/{list_id}", status_code=204)
async def delete_list(
    list_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Delete a list and its items (F-114).

    Cascade is handled by the FK constraint (``ON DELETE CASCADE``).
    ``ref_no`` is **never** re-assigned.
    """
    lst = await _get_owned_list(list_id, user, db)
    await db.delete(lst)
    await db.commit()

    logger.info(
        "List deleted: ref_no=%d title=%r user=%s",
        lst.ref_no,
        lst.title,
        user.id,
    )
    return Response(status_code=204)


# ── List Item Endpoints (F-115) ────────────────────────────────────────────


async def _get_owned_item(
    list_id: uuid.UUID,
    item_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> tuple[List, ListItem]:
    """Fetch a list item by UUID, verifying parent list ownership.

    Returns the (list, item) tuple.  Raises 404 if the list is not
    found/owned or if the item does not belong to that list.
    """
    lst = await _get_owned_list(list_id, user, db)

    result = await db.execute(
        sa.select(ListItem).where(
            ListItem.id == item_id,
            ListItem.list_id == list_id,
        )
    )
    item = result.scalar_one_or_none()

    if item is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "List item not found"},
        )

    return lst, item


@router.post("/{list_id}/items", response_model=ListItemResponse, status_code=201)
async def create_item(
    list_id: uuid.UUID,
    body: ListItemCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ListItemResponse:
    """Create a new item in a list (F-115).

    Returns 404 when *list_id* is not found or not owned by the current user.
    """
    lst = await _get_owned_list(list_id, user, db)

    item = ListItem(
        list_id=lst.id,
        title=body.title,
        description=body.description,
        is_done=body.is_done,
        priority=body.priority,
        due_at=body.due_at,
        notify_before=body.notify_before,
        position=body.position,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    logger.info(
        "Item created: title=%r list_id=%s user=%s",
        body.title,
        list_id,
        user.id,
    )
    return ListItemResponse.model_validate(item)


@router.get("/{list_id}/items", response_model=list[ListItemResponse])
async def list_items(
    list_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[ListItemResponse]:
    """Return all items in a list, ordered by position (F-115).

    Returns 404 when *list_id* is not found or not owned by the current user.
    """
    lst = await _get_owned_list(list_id, user, db)

    result = await db.execute(
        sa.select(ListItem)
        .where(ListItem.list_id == lst.id)
        .order_by(ListItem.position, ListItem.created_at)
    )
    items = result.scalars().all()
    return [ListItemResponse.model_validate(item) for item in items]


@router.patch("/{list_id}/items/{item_id}", response_model=ListItemResponse)
async def update_item(
    list_id: uuid.UUID,
    item_id: uuid.UUID,
    body: ListItemUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ListItemResponse:
    """Partially update a list item (F-115).

    All fields present in the request body are applied, **including**
    those explicitly set to ``null`` (which clears the field).
    ``id``, ``list_id``, and timestamps are **never** modified.

    Returns 404 when the list or item is not found/owned.
    """
    _lst, item = await _get_owned_item(list_id, item_id, user, db)
    updates = body.model_dump(exclude_unset=True)
    mutable = {
        "title", "description", "is_done", "priority",
        "due_at", "notify_before", "position",
    }

    for field, value in updates.items():
        if field in mutable:
            setattr(item, field, value)

    await db.commit()
    await db.refresh(item)

    return ListItemResponse.model_validate(item)


@router.delete("/{list_id}/items/{item_id}", status_code=204)
async def delete_item(
    list_id: uuid.UUID,
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Delete a list item (F-115).

    Returns 404 when the list or item is not found/owned.
    """
    _lst, item = await _get_owned_item(list_id, item_id, user, db)
    await db.delete(item)
    await db.commit()

    logger.info(
        "Item deleted: item_id=%s list_id=%s user=%s",
        item_id,
        list_id,
        user.id,
    )
    return Response(status_code=204)
