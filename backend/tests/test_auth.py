import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.token import InviteToken
from app.models.user import User, UserRole


async def _make_user(db: AsyncSession, email: str = "user@test.com", role: UserRole = UserRole.user) -> User:
    user = User(email=email, full_name="Test User", hashed_password=hash_password("password123"), role=role)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _make_invite(db: AsyncSession, creator_id: int, expired: bool = False) -> InviteToken:
    expires = datetime.now(UTC) + timedelta(hours=-1 if expired else 72)
    invite = InviteToken(token=str(uuid.uuid4()), created_by_id=creator_id, expires_at=expires)
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, db: AsyncSession):
    await _make_user(db)
    r = await client.post("/auth/login", json={"email": "user@test.com", "password": "password123"})
    assert r.status_code == 200
    assert "access_token" in r.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, db: AsyncSession):
    await _make_user(db)
    r = await client.post("/auth/login", json={"email": "user@test.com", "password": "wrong"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_inactive_user(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    user.is_active = False
    await db.commit()
    r = await client.post("/auth/login", json={"email": "user@test.com", "password": "password123"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_register_valid_invite(client: AsyncClient, db: AsyncSession):
    admin = await _make_user(db, email="admin@test.com", role=UserRole.admin)
    invite = await _make_invite(db, creator_id=admin.id)
    r = await client.post("/auth/register", json={
        "token": invite.token,
        "full_name": "New User",
        "email": "new@test.com",
        "password": "password123",
    })
    assert r.status_code == 201
    assert "access_token" in r.json()


@pytest.mark.asyncio
async def test_register_expired_invite(client: AsyncClient, db: AsyncSession):
    admin = await _make_user(db, email="admin@test.com", role=UserRole.admin)
    invite = await _make_invite(db, creator_id=admin.id, expired=True)
    r = await client.post("/auth/register", json={
        "token": invite.token,
        "full_name": "New User",
        "email": "new@test.com",
        "password": "password123",
    })
    assert r.status_code == 410


@pytest.mark.asyncio
async def test_register_invalid_token(client: AsyncClient, db: AsyncSession):
    r = await client.post("/auth/register", json={
        "token": str(uuid.uuid4()),
        "full_name": "New User",
        "email": "new@test.com",
        "password": "password123",
    })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_register_duplicate_invite_use(client: AsyncClient, db: AsyncSession):
    admin = await _make_user(db, email="admin@test.com", role=UserRole.admin)
    invite = await _make_invite(db, creator_id=admin.id)
    payload = {"token": invite.token, "full_name": "User", "email": "u@test.com", "password": "password123"}
    r1 = await client.post("/auth/register", json=payload)
    assert r1.status_code == 201
    payload["email"] = "u2@test.com"
    r2 = await client.post("/auth/register", json=payload)
    assert r2.status_code == 400  # token already used


@pytest.mark.asyncio
async def test_me_requires_auth(client: AsyncClient):
    r = await client.get("/users/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_profile(client: AsyncClient, db: AsyncSession):
    await _make_user(db)
    login = await client.post("/auth/login", json={"email": "user@test.com", "password": "password123"})
    token = login.json()["access_token"]
    r = await client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "user@test.com"
