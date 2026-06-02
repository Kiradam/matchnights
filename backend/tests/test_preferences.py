import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.group import Group, UserGroup
from app.models.match import Match, MatchStatus
from app.models.user import User, UserRole


async def _admin(db: AsyncSession) -> User:
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


async def _group(db: AsyncSession, *users: User) -> Group:
    grp = Group(name=f"grp-{users[0].email}")
    db.add(grp)
    await db.flush()
    for u in users:
        db.add(UserGroup(user_id=u.id, group_id=grp.id))
    await db.commit()
    await db.refresh(grp)
    return grp


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
    u = await _user(db)
    grp = await _group(db, u)
    m = await _match(db)
    token = await _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.put(
        f"/matches/{m.id}/preference",
        json={"choice": "watch_together", "group_id": grp.id},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["choice"] == "watch_together"

    r2 = await client.get("/users/me/preferences", headers=headers)
    assert any(p["choice"] == "watch_together" for p in r2.json())


@pytest.mark.asyncio
async def test_update_preference(client: AsyncClient, db: AsyncSession):
    u = await _user(db)
    grp = await _group(db, u)
    m = await _match(db)
    token = await _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    await client.put(
        f"/matches/{m.id}/preference",
        json={"choice": "watch", "group_id": grp.id},
        headers=headers,
    )
    r = await client.put(
        f"/matches/{m.id}/preference",
        json={"choice": "skip", "group_id": grp.id},
        headers=headers,
    )
    assert r.json()["choice"] == "skip"


@pytest.mark.asyncio
async def test_delete_preference(client: AsyncClient, db: AsyncSession):
    u = await _user(db)
    grp = await _group(db, u)
    m = await _match(db)
    token = await _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    await client.put(
        f"/matches/{m.id}/preference",
        json={"choice": "watch", "group_id": grp.id},
        headers=headers,
    )
    r = await client.delete(
        f"/matches/{m.id}/preference",
        params={"group_id": grp.id},
        headers=headers,
    )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_preference_locked_for_live_match(client: AsyncClient, db: AsyncSession):
    u = await _user(db)
    grp = await _group(db, u)
    m = await _match(db, status=MatchStatus.live)
    token = await _login(client)
    r = await client.put(
        f"/matches/{m.id}/preference",
        json={"choice": "watch", "group_id": grp.id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_group_visibility(client: AsyncClient, db: AsyncSession):
    """User in same group sees group-mate's preference; outsider does not."""
    u1 = await _user(db, "u1@t.com")
    u2 = await _user(db, "u2@t.com")
    await _user(db, "u3@t.com")  # outsider — not in the group
    grp = await _group(db, u1, u2)
    m = await _match(db)

    # u2 sets preference
    t2 = await _login(client, "u2@t.com")
    await client.put(
        f"/matches/{m.id}/preference",
        json={"choice": "watch_together", "group_id": grp.id},
        headers={"Authorization": f"Bearer {t2}"},
    )

    # u1 (same group) should see u2's preference
    t1 = await _login(client, "u1@t.com")
    r = await client.get(f"/matches/{m.id}/preferences", headers={"Authorization": f"Bearer {t1}"})
    assert r.status_code == 200
    summaries = r.json()
    group_summary = next((s for s in summaries if s["group_id"] == grp.id), None)
    assert group_summary is not None
    member_ids = [mem["user_id"] for mem in group_summary["members"]]
    assert u2.id in member_ids

    # u3 (no group) should get an empty summary list
    t3 = await _login(client, "u3@t.com")
    r3 = await client.get(f"/matches/{m.id}/preferences", headers={"Authorization": f"Bearer {t3}"})
    assert r3.json() == []
