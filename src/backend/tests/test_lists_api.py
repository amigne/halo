"""HTTP integration tests for /modules/lists CRUD — dual-engine (step 4-3).

Covers F-111 (create), F-112 (list/get), F-113 (partial update),
F-114 (delete), owner scoping, atomic ref_no, and field_schema presets.
"""

import pytest
from httpx import AsyncClient

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
    email: str = "list-test@test.local",
) -> AsyncClient:
    """Register, verify, and log in. Returns the client with session cookie."""
    from datetime import UTC, datetime

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


# ── Create (F-111) ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_list_tasks_with_preset(http_client: AsyncClient) -> None:
    """Creating a 'tasks' list without field_schema applies the tasks preset."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "My Tasks", "list_type": "tasks"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "My Tasks"
    assert data["list_type"] == "tasks"
    assert data["ref_no"] == 1
    assert "id" in data
    # Preset field_schema should have tasks fields
    field_keys = {f["key"] for f in data["field_schema"]["fields"]}
    assert field_keys >= {"title", "description", "priority", "due_at", "is_done"}


@pytest.mark.asyncio
async def test_create_list_checklist_with_preset(http_client: AsyncClient) -> None:
    """Creating a 'checklist' list without field_schema applies the preset."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Checklist", "list_type": "checklist"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["list_type"] == "checklist"
    field_keys = {f["key"] for f in data["field_schema"]["fields"]}
    assert field_keys == {"title", "is_done"}


@pytest.mark.asyncio
async def test_create_list_ideas_with_preset(http_client: AsyncClient) -> None:
    """Creating an 'ideas' list without field_schema applies the ideas preset."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Ideas", "list_type": "ideas"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["list_type"] == "ideas"
    field_keys = {f["key"] for f in data["field_schema"]["fields"]}
    assert field_keys == {"title", "description"}


@pytest.mark.asyncio
async def test_create_list_custom_with_custom_schema(http_client: AsyncClient) -> None:
    """Creating a 'custom' list without field_schema gives empty fields."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Custom", "list_type": "custom"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["list_type"] == "custom"
    assert data["field_schema"]["fields"] == []


@pytest.mark.asyncio
async def test_create_list_with_explicit_field_schema(http_client: AsyncClient) -> None:
    """Providing field_schema overrides the preset."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    custom_schema = {"fields": [{"key": "title", "type": "text", "required": True}]}
    r = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={
            "title": "Override",
            "list_type": "tasks",
            "field_schema": custom_schema,
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["field_schema"] == custom_schema


@pytest.mark.asyncio
async def test_create_list_with_icon(http_client: AsyncClient) -> None:
    """Icon is stored when provided."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Starred", "list_type": "ideas", "icon": "⭐"},
    )
    assert r.status_code == 201
    assert r.json()["icon"] == "⭐"


# ── ref_no atomicity ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ref_no_sequential_and_never_reused(http_client: AsyncClient) -> None:
    """ref_no is sequential per (personal, user, lists) and never re-assigned."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    # Create 3 lists
    ids = []
    for i in range(3):
        r = await _csrf_post(
            http_client,
            "/api/v1/modules/lists",
            csrf,
            json={"title": f"List {i + 1}", "list_type": "checklist"},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["ref_no"] == i + 1
        ids.append(data["id"])

    # Delete the second list (ref_no=2)
    r_del = await _csrf_delete(http_client, f"/api/v1/modules/lists/{ids[1]}", csrf)
    assert r_del.status_code == 204

    # Create a 4th — ref_no must be 4 (never reuses 2)
    r4 = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "List 4", "list_type": "checklist"},
    )
    assert r4.status_code == 201
    assert r4.json()["ref_no"] == 4


@pytest.mark.asyncio
async def test_ref_no_scoped_per_user(http_client: AsyncClient) -> None:
    """Each user has their own ref_no sequence."""
    await _register_and_login(http_client, email="user-a@test.local")
    csrf_a = await _fetch_csrf(http_client)

    r = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf_a,
        json={"title": "A1", "list_type": "checklist"},
    )
    assert r.status_code == 201
    assert r.json()["ref_no"] == 1

    # Register a second user (fresh client needed for separate cookie jar)
    from httpx import ASGITransport

    from halo_api.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c2:
        # Disable CSRF for second user registration by re-using the same
        # session cookie jar pattern — just do a fresh register+login
        await _register_and_login(c2, email="user-b@test.local")
        csrf_b = await _fetch_csrf(c2)

        r2 = await _csrf_post(
            c2,
            "/api/v1/modules/lists",
            csrf_b,
            json={"title": "B1", "list_type": "checklist"},
        )
        assert r2.status_code == 201
        assert r2.json()["ref_no"] == 1  # User B starts at 1 too


# ── List / Get (F-112) ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_own_lists_only(http_client: AsyncClient) -> None:
    """GET /modules/lists returns only the current user's lists."""
    await _register_and_login(http_client, email="owner@test.local")
    csrf = await _fetch_csrf(http_client)

    # Create 2 lists
    for title in ("Alpha", "Beta"):
        r = await _csrf_post(
            http_client,
            "/api/v1/modules/lists",
            csrf,
            json={"title": title, "list_type": "checklist"},
        )
        assert r.status_code == 201

    # GET all
    r = await http_client.get("/api/v1/modules/lists")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    titles = {d["title"] for d in data}
    assert titles == {"Alpha", "Beta"}


@pytest.mark.asyncio
async def test_get_single_list(http_client: AsyncClient) -> None:
    """GET /modules/lists/{id} returns the list."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Single", "list_type": "ideas"},
    )
    list_id = r_create.json()["id"]

    r = await http_client.get(f"/api/v1/modules/lists/{list_id}")
    assert r.status_code == 200
    assert r.json()["title"] == "Single"


@pytest.mark.asyncio
async def test_get_list_not_found(http_client: AsyncClient) -> None:
    """GET with non-existent UUID returns 404."""
    await _register_and_login(http_client)
    r = await http_client.get(
        "/api/v1/modules/lists/00000000-0000-0000-0000-000000000000"
    )
    assert r.status_code == 404


# ── Owner scoping / cross-user isolation ─────────────────────────────────────


@pytest.mark.asyncio
async def test_cannot_see_other_users_list(http_client: AsyncClient) -> None:
    """User A's list does not appear in User B's GET /modules/lists."""
    from httpx import ASGITransport

    from halo_api.main import app

    # User A creates a list
    await _register_and_login(http_client, email="user-a@test.local")
    csrf_a = await _fetch_csrf(http_client)
    r_a = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf_a,
        json={"title": "A's List", "list_type": "checklist"},
    )
    assert r_a.status_code == 201
    list_a_id = r_a.json()["id"]

    # User B logs in (separate client)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c2:
        await _register_and_login(c2, email="user-b@test.local")
        csrf_b = await _fetch_csrf(c2)

        # Create B's own list
        r_b = await _csrf_post(
            c2,
            "/api/v1/modules/lists",
            csrf_b,
            json={"title": "B's List", "list_type": "checklist"},
        )
        assert r_b.status_code == 201

        # B's GET /modules/lists should NOT include A's list
        r_list = await c2.get("/api/v1/modules/lists")
        assert r_list.status_code == 200
        ids = {d["id"] for d in r_list.json()}
        assert list_a_id not in ids
        assert len(r_list.json()) == 1

        # B's GET /modules/lists/{a_id} → 404
        r_get = await c2.get(f"/api/v1/modules/lists/{list_a_id}")
        assert r_get.status_code == 404

        # B's PATCH /modules/lists/{a_id} → 404
        r_patch = await _csrf_patch(
            c2,
            f"/api/v1/modules/lists/{list_a_id}",
            csrf_b,
            json={"title": "Stolen"},
        )
        assert r_patch.status_code == 404

        # B's DELETE /modules/lists/{a_id} → 404
        r_del = await _csrf_delete(c2, f"/api/v1/modules/lists/{list_a_id}", csrf_b)
        assert r_del.status_code == 404


@pytest.mark.asyncio
async def test_cannot_get_other_users_list_by_id(http_client: AsyncClient) -> None:
    """Direct GET by ID of another user's list returns 404."""
    from httpx import ASGITransport

    from halo_api.main import app

    await _register_and_login(http_client, email="alice@test.local")
    csrf = await _fetch_csrf(http_client)
    r = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Alice", "list_type": "checklist"},
    )
    alice_id = r.json()["id"]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c2:
        await _register_and_login(c2, email="bob@test.local")
        r_get = await c2.get(f"/api/v1/modules/lists/{alice_id}")
        assert r_get.status_code == 404


# ── PATCH partial update (F-113) ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_updates_title(http_client: AsyncClient) -> None:
    """PATCH changes the title."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Original", "list_type": "tasks"},
    )
    list_id = r_create.json()["id"]
    original_ref_no = r_create.json()["ref_no"]
    original_type = r_create.json()["list_type"]

    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}",
        csrf,
        json={"title": "Renamed"},
    )
    assert r_patch.status_code == 200
    data = r_patch.json()
    assert data["title"] == "Renamed"
    assert data["ref_no"] == original_ref_no
    assert data["list_type"] == original_type


@pytest.mark.asyncio
async def test_patch_updates_icon(http_client: AsyncClient) -> None:
    """PATCH changes the icon."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "With Icon", "list_type": "ideas", "icon": "📋"},
    )
    list_id = r_create.json()["id"]

    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}",
        csrf,
        json={"icon": "✅"},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["icon"] == "✅"


@pytest.mark.asyncio
async def test_patch_updates_field_schema(http_client: AsyncClient) -> None:
    """PATCH can replace the field_schema."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Schema Test", "list_type": "custom"},
    )
    list_id = r_create.json()["id"]

    new_schema = {"fields": [{"key": "custom_field", "type": "text"}]}
    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}",
        csrf,
        json={"field_schema": new_schema},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["field_schema"] == new_schema


@pytest.mark.asyncio
async def test_patch_empty_body_is_noop(http_client: AsyncClient) -> None:
    """PATCH with empty body returns the unchanged list."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "No Change", "list_type": "checklist"},
    )
    list_id = r_create.json()["id"]

    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}",
        csrf,
        json={},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["title"] == "No Change"


@pytest.mark.asyncio
async def test_patch_ref_no_immutable(http_client: AsyncClient) -> None:
    """PATCH cannot change ref_no — it is simply ignored."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Immutable", "list_type": "checklist"},
    )
    list_id = r_create.json()["id"]
    original_ref_no = r_create.json()["ref_no"]

    # Try sending ref_no in body — it is ignored (not a known field of ListUpdate)
    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}",
        csrf,
        json={"title": "Still Immutable", "ref_no": 999},
    )
    assert r_patch.status_code == 200
    data = r_patch.json()
    assert data["ref_no"] == original_ref_no  # Unchanged
    assert data["list_type"] == "checklist"  # Also unchanged


@pytest.mark.asyncio
async def test_patch_list_type_immutable(http_client: AsyncClient) -> None:
    """PATCH cannot change list_type — it is ignored."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Type Test", "list_type": "checklist"},
    )
    list_id = r_create.json()["id"]

    # Try sending list_type in body — it is ignored (not a known field of ListUpdate)
    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}",
        csrf,
        json={"list_type": "tasks"},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["list_type"] == "checklist"  # Unchanged


# ── Delete (F-114) ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_list(http_client: AsyncClient) -> None:
    """DELETE removes the list and returns 204."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "To Delete", "list_type": "checklist"},
    )
    list_id = r_create.json()["id"]

    r_del = await _csrf_delete(http_client, f"/api/v1/modules/lists/{list_id}", csrf)
    assert r_del.status_code == 204

    # Verify gone
    r_get = await http_client.get(f"/api/v1/modules/lists/{list_id}")
    assert r_get.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_returns_404(http_client: AsyncClient) -> None:
    """Deleting a non-existent list returns 404."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_del = await _csrf_delete(
        http_client,
        "/api/v1/modules/lists/00000000-0000-0000-0000-000000000000",
        csrf,
    )
    assert r_del.status_code == 404


# ── Authentication ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unauthenticated_get_returns_401(http_client: AsyncClient) -> None:
    """GET endpoints require authentication (safe methods skip CSRF)."""
    r = await http_client.get("/api/v1/modules/lists")
    assert r.status_code == 401

    r = await http_client.get(
        "/api/v1/modules/lists/00000000-0000-0000-0000-000000000000"
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_unauthenticated_mutation_csrf_blocks(http_client: AsyncClient) -> None:
    """Unauthenticated mutations are blocked by CSRF middleware first (403)."""
    r = await http_client.post(
        "/api/v1/modules/lists",
        json={"title": "X", "list_type": "checklist"},
    )
    assert r.status_code == 403
    assert r.json()["code"] == "CSRF_INVALID"

    r = await http_client.patch(
        "/api/v1/modules/lists/00000000-0000-0000-0000-000000000000",
        json={"title": "X"},
    )
    assert r.status_code == 403

    r = await http_client.delete(
        "/api/v1/modules/lists/00000000-0000-0000-0000-000000000000",
    )
    assert r.status_code == 403


# ── CSRF protection on mutations ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_csrf_blocks_create_without_header(http_client: AsyncClient) -> None:
    """POST without CSRF header → 403."""
    await _register_and_login(http_client)
    r = await http_client.post(
        "/api/v1/modules/lists",
        json={"title": "No CSRF", "list_type": "checklist"},
    )
    assert r.status_code == 403
    assert r.json()["code"] == "CSRF_INVALID"


@pytest.mark.asyncio
async def test_csrf_blocks_patch_without_header(http_client: AsyncClient) -> None:
    """PATCH without CSRF header → 403."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    # Create a list first (legitimately, with CSRF)
    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "CSRF Test", "list_type": "checklist"},
    )
    list_id = r_create.json()["id"]

    # Try PATCH without CSRF header
    r = await http_client.patch(
        f"/api/v1/modules/lists/{list_id}",
        json={"title": "Hacked"},
    )
    assert r.status_code == 403
    assert r.json()["code"] == "CSRF_INVALID"


@pytest.mark.asyncio
async def test_csrf_blocks_delete_without_header(http_client: AsyncClient) -> None:
    """DELETE without CSRF header → 403."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "CSRF Delete", "list_type": "checklist"},
    )
    list_id = r_create.json()["id"]

    r = await http_client.delete(f"/api/v1/modules/lists/{list_id}")
    assert r.status_code == 403
    assert r.json()["code"] == "CSRF_INVALID"


# ── Validation ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_invalid_list_type(http_client: AsyncClient) -> None:
    """Creating with an invalid list_type returns 422."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Bad", "list_type": "invalid"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_empty_title(http_client: AsyncClient) -> None:
    """Creating with an empty title returns 422."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "", "list_type": "checklist"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_patch_null_title_is_ignored(http_client: AsyncClient) -> None:
    """PATCH {title:null} returns 200 and keeps the original title (non-nullable)."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "Original", "list_type": "tasks"},
    )
    list_id = r_create.json()["id"]

    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}",
        csrf,
        json={"title": None},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["title"] == "Original"


@pytest.mark.asyncio
async def test_patch_null_icon_clears_it(http_client: AsyncClient) -> None:
    """PATCH {icon:null} returns 200 and clears the icon (nullable)."""
    await _register_and_login(http_client)
    csrf = await _fetch_csrf(http_client)

    r_create = await _csrf_post(
        http_client,
        "/api/v1/modules/lists",
        csrf,
        json={"title": "With Icon", "list_type": "tasks", "icon": "star"},
    )
    list_id = r_create.json()["id"]
    assert r_create.json()["icon"] == "star"

    r_patch = await _csrf_patch(
        http_client,
        f"/api/v1/modules/lists/{list_id}",
        csrf,
        json={"icon": None},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["icon"] is None
