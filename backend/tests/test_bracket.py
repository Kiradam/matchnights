"""Tests for the knockout bracket endpoint."""
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.match import Match, MatchStatus
from app.models.user import User


async def _user(db: AsyncSession, email: str = "u@t.com") -> User:
    u = User(email=email, full_name="U", hashed_password=hash_password("pass1234"))
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _login(client: AsyncClient, email: str = "u@t.com") -> str:
    r = await client.post("/auth/login", json={"email": email, "password": "pass1234"})
    return r.json()["access_token"]


async def _ko_match(db, ext_id, stage, home, away, *, home_tla=None, away_tla=None,
                    home_score=None, away_score=None, status=MatchStatus.scheduled):
    m = Match(
        external_id=ext_id,
        home_team=home,
        away_team=away,
        home_team_tla=home_tla,
        away_team_tla=away_tla,
        stage=stage,
        match_datetime=datetime(2026, 7, 1, tzinfo=UTC) + timedelta(days=int(ext_id[-2:]) % 30),
        status=status,
        home_score=home_score,
        away_score=away_score,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


@pytest.mark.asyncio
async def test_bracket_requires_auth(client: AsyncClient):
    r = await client.get("/bracket")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_bracket_returns_all_rounds(client: AsyncClient, db: AsyncSession):
    await _user(db)
    token = await _login(client)
    r = await client.get("/bracket", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    keys = [rd["key"] for rd in r.json()["rounds"]]
    assert keys == ["r32", "r16", "qf", "sf", "final", "third"]


@pytest.mark.asyncio
async def test_bracket_excludes_group_matches(client: AsyncClient, db: AsyncSession):
    await _user(db)
    await _ko_match(db, "g01", "Group A", "Mexico", "South Africa")
    await _ko_match(db, "k01", "Round of 32", "Brazil", "Japan")
    token = await _login(client)
    r = await client.get("/bracket", headers={"Authorization": f"Bearer {token}"})
    r32 = next(rd for rd in r.json()["rounds"] if rd["key"] == "r32")
    teams = {m["home"]["name"] for m in r32["matches"]}
    assert "Brazil" in teams
    assert "Mexico" not in teams  # group match excluded


@pytest.mark.asyncio
async def test_source_links_by_team_identity(client: AsyncClient, db: AsyncSession):
    """An R16 team is linked to the R32 match it actually played in."""
    await _user(db)
    # Two R32 matches; winners advance to one R16 match
    r32a = await _ko_match(db, "k10", "Round of 32", "Brazil", "Japan",
                           home_score=2, away_score=0, status=MatchStatus.finished)
    r32b = await _ko_match(db, "k11", "Round of 32", "France", "Sweden",
                           home_score=1, away_score=0, status=MatchStatus.finished)
    # R16: Brazil (from k10) vs France (from k11)
    await _ko_match(db, "k20", "Round of 16", "Brazil", "France")

    token = await _login(client)
    r = await client.get("/bracket", headers={"Authorization": f"Bearer {token}"})
    r16 = next(rd for rd in r.json()["rounds"] if rd["key"] == "r16")
    match = r16["matches"][0]
    assert match["home_source_match_id"] == r32a.id
    assert match["away_source_match_id"] == r32b.id


@pytest.mark.asyncio
async def test_tbd_teams_have_no_source(client: AsyncClient, db: AsyncSession):
    await _user(db)
    await _ko_match(db, "k30", "Round of 32", "Brazil", "Japan",
                    home_score=2, away_score=0, status=MatchStatus.finished)
    await _ko_match(db, "k40", "Round of 16", "TBD", "TBD")
    token = await _login(client)
    r = await client.get("/bracket", headers={"Authorization": f"Bearer {token}"})
    r16 = next(rd for rd in r.json()["rounds"] if rd["key"] == "r16")
    match = r16["matches"][0]
    assert match["home"]["is_tbd"] is True
    assert match["home_source_match_id"] is None
    assert match["away_source_match_id"] is None


@pytest.mark.asyncio
async def test_match_carries_score_and_tla(client: AsyncClient, db: AsyncSession):
    await _user(db)
    await _ko_match(db, "k50", "Round of 32", "South Africa", "Canada",
                    home_tla="RSA", away_tla="CAN",
                    home_score=0, away_score=1, status=MatchStatus.finished)
    token = await _login(client)
    r = await client.get("/bracket", headers={"Authorization": f"Bearer {token}"})
    r32 = next(rd for rd in r.json()["rounds"] if rd["key"] == "r32")
    m = r32["matches"][0]
    assert m["home"]["tla"] == "RSA" and m["home"]["score"] == 0
    assert m["away"]["tla"] == "CAN" and m["away"]["score"] == 1
