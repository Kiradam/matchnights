import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole


async def _admin(db: AsyncSession) -> User:
    u = User(
        email="admin@t.com",
        full_name="Admin",
        hashed_password=hash_password("pass1234"),
        role=UserRole.admin,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _user(db: AsyncSession, email: str = "user@t.com") -> User:
    u = User(email=email, full_name="Regular User", hashed_password=hash_password("pass1234"))
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _login(client: AsyncClient, email: str, password: str = "pass1234") -> str:
    r = await client.post("/auth/login", json={"email": email, "password": password})
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_create_group(client: AsyncClient, db: AsyncSession):
    await _admin(db)
    token = await _login(client, "admin@t.com")
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/admin/groups",
        json={"name": "Friends", "description": "Close friends"},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Friends"
    assert data["description"] == "Close friends"
    assert data["member_count"] == 0


@pytest.mark.asyncio
async def test_create_group_duplicate_name(client: AsyncClient, db: AsyncSession):
    await _admin(db)
    token = await _login(client, "admin@t.com")
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/admin/groups", json={"name": "Friends"}, headers=headers)
    r = await client.post("/admin/groups", json={"name": "Friends"}, headers=headers)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_list_groups(client: AsyncClient, db: AsyncSession):
    await _admin(db)
    token = await _login(client, "admin@t.com")
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/admin/groups", json={"name": "Alpha"}, headers=headers)
    await client.post("/admin/groups", json={"name": "Beta"}, headers=headers)

    r = await client.get("/admin/groups", headers=headers)
    assert r.status_code == 200
    names = [g["name"] for g in r.json()]
    assert "Alpha" in names
    assert "Beta" in names


@pytest.mark.asyncio
async def test_list_groups_pagination(client: AsyncClient, db: AsyncSession):
    await _admin(db)
    token = await _login(client, "admin@t.com")
    headers = {"Authorization": f"Bearer {token}"}

    for i in range(5):
        await client.post("/admin/groups", json={"name": f"Group {i}"}, headers=headers)

    r = await client.get("/admin/groups", params={"page": 1, "page_size": 3}, headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 3


@pytest.mark.asyncio
async def test_update_group(client: AsyncClient, db: AsyncSession):
    await _admin(db)
    token = await _login(client, "admin@t.com")
    headers = {"Authorization": f"Bearer {token}"}

    created = (await client.post("/admin/groups", json={"name": "Old Name"}, headers=headers)).json()
    r = await client.patch(
        f"/admin/groups/{created['id']}",
        json={"name": "New Name", "description": "Updated"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_group(client: AsyncClient, db: AsyncSession):
    await _admin(db)
    token = await _login(client, "admin@t.com")
    headers = {"Authorization": f"Bearer {token}"}

    created = (await client.post("/admin/groups", json={"name": "ToDelete"}, headers=headers)).json()
    r = await client.delete(f"/admin/groups/{created['id']}", headers=headers)
    assert r.status_code == 204

    r2 = await client.get("/admin/groups", headers=headers)
    assert all(g["id"] != created["id"] for g in r2.json())


@pytest.mark.asyncio
async def test_add_and_list_members(client: AsyncClient, db: AsyncSession):
    await _admin(db)
    u = await _user(db)
    token = await _login(client, "admin@t.com")
    headers = {"Authorization": f"Bearer {token}"}

    grp = (await client.post("/admin/groups", json={"name": "WithMembers"}, headers=headers)).json()
    r = await client.post(
        f"/admin/groups/{grp['id']}/members",
        json={"user_id": u.id},
        headers=headers,
    )
    assert r.status_code == 204

    r2 = await client.get(f"/admin/groups/{grp['id']}/members", headers=headers)
    assert r2.status_code == 200
    assert any(m["user_id"] == u.id for m in r2.json())

    r3 = await client.get(f"/admin/groups/{grp['id']}", headers=headers) if False else \
         await client.get("/admin/groups", headers=headers)
    group_data = next(g for g in r3.json() if g["id"] == grp["id"])
    assert group_data["member_count"] == 1


@pytest.mark.asyncio
async def test_add_member_idempotent(client: AsyncClient, db: AsyncSession):
    await _admin(db)
    u = await _user(db)
    token = await _login(client, "admin@t.com")
    headers = {"Authorization": f"Bearer {token}"}

    grp = (await client.post("/admin/groups", json={"name": "Idempotent"}, headers=headers)).json()
    await client.post(f"/admin/groups/{grp['id']}/members", json={"user_id": u.id}, headers=headers)
    r = await client.post(f"/admin/groups/{grp['id']}/members", json={"user_id": u.id}, headers=headers)
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_remove_member(client: AsyncClient, db: AsyncSession):
    await _admin(db)
    u = await _user(db)
    token = await _login(client, "admin@t.com")
    headers = {"Authorization": f"Bearer {token}"}

    grp = (await client.post("/admin/groups", json={"name": "RemoveTest"}, headers=headers)).json()
    await client.post(f"/admin/groups/{grp['id']}/members", json={"user_id": u.id}, headers=headers)
    r = await client.delete(f"/admin/groups/{grp['id']}/members/{u.id}", headers=headers)
    assert r.status_code == 204

    members = (await client.get(f"/admin/groups/{grp['id']}/members", headers=headers)).json()
    assert all(m["user_id"] != u.id for m in members)


@pytest.mark.asyncio
async def test_non_admin_cannot_manage_groups(client: AsyncClient, db: AsyncSession):
    await _admin(db)
    await _user(db)
    token = await _login(client, "user@t.com")
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post("/admin/groups", json={"name": "Unauthorized"}, headers=headers)
    assert r.status_code == 403

    r2 = await client.get("/admin/groups", headers=headers)
    assert r2.status_code == 403
