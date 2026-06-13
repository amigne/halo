"""HTTP integration tests for /modules/lists/{id}/items CRUD — dual-engine (step 4-4).

Covers F-115: create, list, partial update, delete, owner scoping,
due_at UTC round-trip, notify_before persistence, and position reordering.
"""

from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient

from halo_api.main import app

# ── CSRF / auth helpers ──────────────────────────────────────────────────────


async def _fetch_csrf(c: AsyncClient) -> str:
    r = await c.get("/api/v1/auth/csrf")
    assert r.status_code == 200
    token: str = r.json()["token"]
    return token


def _csrf_post(c: AsyncClient, path: str, csrf: str, **kw):  # type: ignore[no-untyped-def]
    return c.post(
        path,
        headers={"X-CSRF-Token": csrf, "Content-Type": "application/json"},
        **kw,
    )


def _csrf_patch(c: AsyncClient, path: str, csrf: str, **kw):  # type: ignore[no-untyped-def]
    return c.patch(
        path,
        headers={"X-CSRF-Token": csrf, "Content-Type": "application/json"},
        **kw,
    )


def _csrf_delete(c: AsyncClient, path: str, csrf: str):  # type: ignore[no-untyped-def]
    return c.delete(path, headers={"X-CSRF-Token": csrf})


async def _register_and_login(
    c: AsyncClient,
    email: str = "item-test@test.local",
) -> AsyncClient:
    """Register, verify, and log in. Returns the client with session cookie."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from halo_api.accounts.models import EmailToken, User
    from halo_api.core import db as db_mod

    csrf = await _fetch_csrf(c)

    r = await _csrf_post(
        c,
        "/api/v1/auth/register",
        csrf,
        json={
            "email": email,
            "password": "secret1234",
            "first_name": "Test",
            "last_name": "User",
        },
    )
    assert r.status_code == 201

    # Verify user directly in DB
    sf = async_sessionmaker(db_mod.engine, class_=AsyncSession, expire_on_commit=False)
    async with sf() as s:
        result = await s.execute(
            select(EmailToken).where(EmailToken.purpose == "verify")
        )
        et = result.scalars().first()
        if et is not None:
            et.used_at = datetime.now(UTC)
        user_result = await s.execute(select(User).where(User.email == email))
        user = user_result.scalar_one()
        user.is_verified = True
        await s.commit()

    # Login
    csrf2 = await _fetch_csrf(c)
    r = await _csrf_post(
        c,
        "/api/v1/auth/login",
        csrf2,
        json={"email": email, "password": "secret1234"},
    )
    assert r.status_code == 200

    return c


async def _create_list(
    c: AsyncClient,
    csrf: str,
    title: str = "Test List",
    list_type: str = "tasks",
) -> str:
    """Create a list and return its id."""
    r = await _csrf_post(
        c,
        "/api/v1/modules/lists",
        csrf,
        json={"title": title, "list_type": list_type},
    )
    assert r.status_code == 201
    data: dict[str, object] = r.json()
    return str(data["id"])


# ── Create item (F-115) ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_item_minimal(http_client: AsyncClient) -> None:
    """Create an item with only the required title field."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "Buy milk"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Buy milk"
    assert data["list_id"] == list_id
    assert data["is_done"] is False
    assert data["position"] == 0
    assert data["description"] is None
    assert data["priority"] is None
    assert data["due_at"] is None
    assert data["notify_before"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_item_all_fields(http_client: AsyncClient) -> None:
    """Create an item with every optional field populated."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={
            "title": "Full item",
            "description": "With details",
            "is_done": True,
            "priority": 1,
            "due_at": "2026-07-01T14:00:00Z",
            "notify_before": 3600,
            "position": 5,
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Full item"
    assert data["description"] == "With details"
    assert data["is_done"] is True
    assert data["priority"] == 1
    # due_at round-trip: parse and compare in UTC.
    # SQLite may return naive datetime — treat naive as UTC.
    returned_due = datetime.fromisoformat(data["due_at"])
    if returned_due.tzinfo is None:
        returned_due = returned_due.replace(tzinfo=UTC)
    assert returned_due == datetime(2026, 7, 1, 14, 0, 0, tzinfo=UTC)
    assert data["notify_before"] == 3600
    assert data["position"] == 5


@pytest.mark.asyncio
async def test_create_item_requires_title(http_client: AsyncClient) -> None:
    """POST without title returns 422."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"description": "No title"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_item_empty_title(http_client: AsyncClient) -> None:
    """POST with empty title returns 422."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": ""},
    )
    assert r.status_code == 422


# ── List items ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_items_ordered_by_position(http_client: AsyncClient) -> None:
    """GET /items returns items sorted by position."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    # Create items with explicit positions (reverse order)
    for title, pos in [("Third", 30), ("First", 10), ("Second", 20)]:
        r = await _csrf_post(
            http_client,
            f"/api/v1/modules/lists/{list_id}/items",
            csrf,
            json={"title": title, "position": pos},
        )
        assert r.status_code == 201

    r = await http_client.get(f"/api/v1/modules/lists/{list_id}/items")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 3
    assert [it["position"] for it in items] == [10, 20, 30]
    assert [it["title"] for it in items] == ["First", "Second", "Third"]


@pytest.mark.asyncio
async def test_list_items_empty(http_client: AsyncClient) -> None:
    """GET /items on a list with no items returns empty array."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await http_client.get(f"/api/v1/modules/lists/{list_id}/items")
    assert r.status_code == 200
    assert r.json() == []


# ── PATCH partial update ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_item_title(http_client: AsyncClient) -> None:
    """PATCH updates the title of an item."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "Original"},
    )
    item_id = r.json()["id"]

    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items/{item_id}",
        csrf,
        json={"title": "Renamed"},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["title"] == "Renamed"


@pytest.mark.asyncio
async def test_patch_item_is_done_toggle(http_client: AsyncClient) -> None:
    """PATCH toggles is_done from False to True."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "Task"},
    )
    item_id = r.json()["id"]
    assert r.json()["is_done"] is False

    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items/{item_id}",
        csrf,
        json={"is_done": True},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["is_done"] is True

    # Toggle back to False
    r_patch2 = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items/{item_id}",
        csrf,
        json={"is_done": False},
    )
    assert r_patch2.status_code == 200
    assert r_patch2.json()["is_done"] is False


@pytest.mark.asyncio
async def test_patch_item_position_reorder(http_client: AsyncClient) -> None:
    """PATCH with position reorders items correctly."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    # Create 3 items
    ids = []
    for title, pos in [("A", 0), ("B", 1), ("C", 2)]:
        r = await _csrf_post(
            http_client,
            f"/api/v1/modules/lists/{list_id}/items",
            csrf,
            json={"title": title, "position": pos},
        )
        assert r.status_code == 201
        ids.append(r.json()["id"])

    # Move C (pos=2) to position 0
    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items/{ids[2]}",
        csrf,
        json={"position": 0},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["position"] == 0

    # Verify order — stable sort: (position ASC, created_at ASC).
    # A (pos=0, created first) and C (pos=0, created last) share position 0;
    # A comes first due to earlier created_at.
    r = await http_client.get(f"/api/v1/modules/lists/{list_id}/items")
    items = r.json()
    positions = [it["position"] for it in items]
    titles = [it["title"] for it in items]
    assert titles == ["A", "C", "B"]
    assert positions == [0, 0, 1]


@pytest.mark.asyncio
async def test_patch_item_empty_body_noop(http_client: AsyncClient) -> None:
    """PATCH with empty body returns unchanged item."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "Unchanged", "priority": 5},
    )
    item_id = r.json()["id"]

    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items/{item_id}",
        csrf,
        json={},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["title"] == "Unchanged"
    assert r_patch.json()["priority"] == 5


# ── Delete ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_item(http_client: AsyncClient) -> None:
    """DELETE removes the item and returns 204."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "To delete"},
    )
    item_id = r.json()["id"]

    r_del = await _csrf_delete(
        http_client, f"/api/v1/modules/lists/{list_id}/items/{item_id}", csrf
    )
    assert r_del.status_code == 204

    # Verify gone
    r_get = await http_client.get(f"/api/v1/modules/lists/{list_id}/items")
    assert r_get.status_code == 200
    assert len(r_get.json()) == 0


@pytest.mark.asyncio
async def test_delete_nonexistent_item_returns_404(http_client: AsyncClient) -> None:
    """Deleting a non-existent item returns 404."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r_del = await _csrf_delete(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items/00000000-0000-0000-0000-000000000000",
        csrf,
    )
    assert r_del.status_code == 404


# ── Owner scoping / cross-user isolation ────────────────────────────────────


@pytest.mark.asyncio
async def test_cannot_create_item_in_other_users_list(http_client: AsyncClient) -> None:
    """Creating an item in another user's list returns 404."""
    # User A creates a list
    await _register_and_login(http_client, email="user-a@test.local")
    csrf_a = await _fetch_csrf(http_client)
    list_a_id = await _create_list(http_client, csrf_a, title="A's List")

    # User B tries to create an item in A's list
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c2:
        await _register_and_login(c2, email="user-b@test.local")
        csrf_b = await _fetch_csrf(c2)

        r = await _csrf_post(
            c2,
            f"/api/v1/modules/lists/{list_a_id}/items",
            csrf_b,
            json={"title": "Intruder"},
        )
        assert r.status_code == 404


@pytest.mark.asyncio
async def test_cannot_list_items_of_other_users_list(http_client: AsyncClient) -> None:
    """GET /items on another user's list returns 404."""
    await _register_and_login(http_client, email="user-a@test.local")
    csrf_a = await _fetch_csrf(http_client)
    list_a_id = await _create_list(http_client, csrf_a, title="A's List")

    # Add an item to A's list
    await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_a_id}/items",
        csrf_a,
        json={"title": "A's item"},
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c2:
        await _register_and_login(c2, email="user-b@test.local")

        r = await c2.get(f"/api/v1/modules/lists/{list_a_id}/items")
        assert r.status_code == 404


@pytest.mark.asyncio
async def test_cannot_patch_item_in_other_users_list(http_client: AsyncClient) -> None:
    """PATCH on an item in another user's list returns 404."""
    await _register_and_login(http_client, email="user-a@test.local")
    csrf_a = await _fetch_csrf(http_client)
    list_a_id = await _create_list(http_client, csrf_a, title="A's List")

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_a_id}/items",
        csrf_a,
        json={"title": "A's item"},
    )
    item_a_id = r.json()["id"]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c2:
        await _register_and_login(c2, email="user-b@test.local")
        csrf_b = await _fetch_csrf(c2)

        r_patch = await _csrf_patch(
            c2,
            f"/api/v1/modules/lists/{list_a_id}/items/{item_a_id}",
            csrf_b,
            json={"title": "Stolen"},
        )
        assert r_patch.status_code == 404


@pytest.mark.asyncio
async def test_cannot_delete_item_in_other_users_list(http_client: AsyncClient) -> None:
    """DELETE on an item in another user's list returns 404."""
    await _register_and_login(http_client, email="user-a@test.local")
    csrf_a = await _fetch_csrf(http_client)
    list_a_id = await _create_list(http_client, csrf_a, title="A's List")

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_a_id}/items",
        csrf_a,
        json={"title": "A's item"},
    )
    item_a_id = r.json()["id"]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c2:
        await _register_and_login(c2, email="user-b@test.local")
        csrf_b = await _fetch_csrf(c2)

        r_del = await _csrf_delete(
            c2,
            f"/api/v1/modules/lists/{list_a_id}/items/{item_a_id}",
            csrf_b,
        )
        assert r_del.status_code == 404


@pytest.mark.asyncio
async def test_cannot_access_item_with_wrong_list_id(http_client: AsyncClient) -> None:
    """Accessing an item under a different list_id than its parent returns 404."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list1_id = await _create_list(http_client, csrf, title="List 1")
    list2_id = await _create_list(http_client, csrf, title="List 2")

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list1_id}/items",
        csrf,
        json={"title": "Item in list 1"},
    )
    item_id = r.json()["id"]

    # Try to access via list2's path (use PATCH, which is a valid endpoint)
    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list2_id}/items/{item_id}",
        csrf,
        json={"title": "Wrong list"},
    )
    assert r_patch.status_code == 404


# ── due_at UTC round-trip ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_due_at_utc_roundtrip_exact(http_client: AsyncClient) -> None:
    """due_at stored as UTC is returned exactly as sent."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    expected = datetime(2026, 12, 25, 8, 30, 0, tzinfo=UTC)

    def _parse_dt(s: str) -> datetime:
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "Christmas", "due_at": "2026-12-25T08:30:00Z"},
    )
    assert r.status_code == 201
    assert _parse_dt(r.json()["due_at"]) == expected

    item_id = r.json()["id"]
    r_get = await http_client.get(f"/api/v1/modules/lists/{list_id}/items")
    assert _parse_dt(r_get.json()[0]["due_at"]) == expected

    # Also verify via PATCH round-trip
    new_expected = datetime(2026, 12, 25, 10, 0, 0, tzinfo=UTC)
    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items/{item_id}",
        csrf,
        json={"due_at": "2026-12-25T10:00:00+00:00"},
    )
    assert r_patch.status_code == 200
    assert _parse_dt(r_patch.json()["due_at"]) == new_expected


@pytest.mark.asyncio
async def test_due_at_microsecond_precision(http_client: AsyncClient) -> None:
    """due_at with sub-second precision is preserved."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    utc_str = "2026-06-12T15:30:45.123456Z"
    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "Precise", "due_at": utc_str},
    )
    assert r.status_code == 201
    # At minimum, the datetime was accepted and stored
    assert r.json()["due_at"] is not None
    data = r.json()
    # Pydantic serialises with Z suffix
    assert "2026-06-12T15:30:45" in data["due_at"]


# ── notify_before persistence ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notify_before_persisted(http_client: AsyncClient) -> None:
    """notify_before is stored and returned correctly."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={
            "title": "Meeting",
            "due_at": "2026-07-01T14:00:00Z",
            "notify_before": 1800,
        },
    )
    assert r.status_code == 201
    assert r.json()["notify_before"] == 1800

    # Verify via list GET
    r_list = await http_client.get(f"/api/v1/modules/lists/{list_id}/items")
    assert r_list.json()[0]["notify_before"] == 1800
    item_id = r.json()["id"]

    # Update via PATCH
    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items/{item_id}",
        csrf,
        json={"notify_before": 3600},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["notify_before"] == 3600


@pytest.mark.asyncio
async def test_notify_before_defaults_to_none(http_client: AsyncClient) -> None:
    """notify_before is None when not provided."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "No notification"},
    )
    assert r.status_code == 201
    assert r.json()["notify_before"] is None


# ── Raw title/description storage ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_title_stored_raw_with_tags(http_client: AsyncClient) -> None:
    """Title containing tag markup like {LIST:1} is stored verbatim."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "See {LIST:1} for details", "description": "Ref: {TASK:5}"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "See {LIST:1} for details"
    assert data["description"] == "Ref: {TASK:5}"


# ── Authentication & CSRF ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unauthenticated_items_get_returns_401(http_client: AsyncClient) -> None:
    """GET items requires authentication."""
    r = await http_client.get(
        "/api/v1/modules/lists/00000000-0000-0000-0000-000000000000/items"
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_csrf_blocks_item_create_without_header(http_client: AsyncClient) -> None:
    """POST items without CSRF header → 403."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await http_client.post(
        f"/api/v1/modules/lists/{list_id}/items",
        json={"title": "No CSRF"},
    )
    assert r.status_code == 403
    assert r.json()["code"] == "CSRF_INVALID"


@pytest.mark.asyncio
async def test_csrf_blocks_item_patch_without_header(http_client: AsyncClient) -> None:
    """PATCH items without CSRF header → 403."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "CSRF test"},
    )
    item_id = r.json()["id"]

    r_patch = await http_client.patch(
        f"/api/v1/modules/lists/{list_id}/items/{item_id}",
        json={"title": "Hacked"},
    )
    assert r_patch.status_code == 403
    assert r_patch.json()["code"] == "CSRF_INVALID"


@pytest.mark.asyncio
async def test_csrf_blocks_item_delete_without_header(http_client: AsyncClient) -> None:
    """DELETE items without CSRF header → 403."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "CSRF delete"},
    )
    item_id = r.json()["id"]

    r_del = await http_client.delete(f"/api/v1/modules/lists/{list_id}/items/{item_id}")
    assert r_del.status_code == 403
    assert r_del.json()["code"] == "CSRF_INVALID"


@pytest.mark.asyncio
async def test_patch_item_null_title_ignored(http_client: AsyncClient) -> None:
    """PATCH {title:null} on an item → 200, title kept (non-nullable)."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "Original Item"},
    )
    item_id = r.json()["id"]

    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items/{item_id}",
        csrf,
        json={"title": None},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["title"] == "Original Item"


@pytest.mark.asyncio
async def test_patch_item_null_description_clears(http_client: AsyncClient) -> None:
    """PATCH {description:null} on an item → 200, description cleared (nullable)."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)
    list_id = await _create_list(http_client, csrf)

    r = await _csrf_post(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items",
        csrf,
        json={"title": "An item", "description": "Some notes"},
    )
    item_id = r.json()["id"]
    assert r.json()["description"] == "Some notes"

    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}/items/{item_id}",
        csrf,
        json={"description": None},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["description"] is None
