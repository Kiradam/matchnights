import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.group import Group, UserGroup
from app.models.match import Match, MatchStatus
from app.models.user import User, UserRole


async def _admin(db: AsyncSession) -> tuple[User, str]:
    u = User(email="admin@t.com", full_name="Admin", hashed_password=hash_password("pass1234"), role=UserRole.admin)
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _user(db: AsyncSession, email: str = "user@t.com") -> User:
    u = User(email=email, full_name="User", hashed_password=hash_password("pass1234"))
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _match(db: AsyncSession, status: MatchStatus = MatchStatus.scheduled) -> Match:
    from datetime import datetime
    m = Match(external_id="ext-1", home_team="A", away_team="B", stage="Group A",
               match_datetime=datetime(2026, 6, 11, 18, 0), status=status)
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


async def _login(client: AsyncClient, email: str = "user@t.com") -> str:
    r = await client.post("/auth/login", json={"email": email, "password": "pass1234"})
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_set_and_get_preference(client: AsyncClient, db: AsyncSession):
    await _user(db)
    m = await _match(db)
    token = await _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.put(f"/matches/{m.id}/preference", json={"choice": "watch_together"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["choice"] == "watch_together"

    r2 = await client.get("/users/me/preferences", headers=headers)
    assert any(p["choice"] == "watch_together" for p in r2.json())


@pytest.mark.asyncio
async def test_update_preference(client: AsyncClient, db: AsyncSession):
    await _user(db)
    m = await _match(db)
    token = await _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    await client.put(f"/matches/{m.id}/preference", json={"choice": "watch"}, headers=headers)
    r = await client.put(f"/matches/{m.id}/preference", json={"choice": "skip"}, headers=headers)
    assert r.json()["choice"] == "skip"


@pytest.mark.asyncio
async def test_delete_preference(client: AsyncClient, db: AsyncSession):
    await _user(db)
    m = await _match(db)
    token = await _login(client)
    headers = {"Authorization": f"Bearer {token}"}
    await client.put(f"/matches/{m.id}/preference", json={"choice": "watch"}, headers=headers)
    r = await client.delete(f"/matches/{m.id}/preference", headers=headers)
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_preference_locked_for_live_match(client: AsyncClient, db: AsyncSession):
    await _user(db)
    m = await _match(db, status=MatchStatus.live)
    token = await _login(client)
    r = await client.put(f"/matches/{m.id}/preference", json={"choice": "watch"},
                         headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_group_visibility(client: AsyncClient, db: AsyncSession):
    """User in same group sees group-mate's preference; outsider does not."""
    u1 = await _user(db, "u1@t.com")
    u2 = await _user(db, "u2@t.com")
    await _user(db, "u3@t.com")  # outsider — not in the group
    m = await _match(db)

    grp = Group(name="TestGroup")
    db.add(grp)
    await db.flush()
    db.add(UserGroup(user_id=u1.id, group_id=grp.id))
    db.add(UserGroup(user_id=u2.id, group_id=grp.id))
    await db.commit()

    # u2 sets preference
    t2 = await _login(client, "u2@t.com")
    await client.put(f"/matches/{m.id}/preference", json={"choice": "watch_together"},
                     headers={"Authorization": f"Bearer {t2}"})

    # u1 (same group) should see u2's preference
    t1 = await _login(client, "u1@t.com")
    r = await client.get(f"/matches/{m.id}/preferences", headers={"Authorization": f"Bearer {t1}"})
    assert r.status_code == 200
    member_ids = [mem["user_id"] for mem in r.json()["members"]]
    assert u2.id in member_ids

    # u3 (no group) should only see themselves
    t3 = await _login(client, "u3@t.com")
    r3 = await client.get(f"/matches/{m.id}/preferences", headers={"Authorization": f"Bearer {t3}"})
    member_ids_3 = [mem["user_id"] for mem in r3.json()["members"]]
    assert u2.id not in member_ids_3
    assert u1.id not in member_ids_3
