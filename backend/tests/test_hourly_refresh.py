"""Tests for the hourly refresh scheduler job."""
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.match import Match, MatchStatus
from app.services import scheduler
from app.services.football_api import NormalisedMatch


def _factory_for(session):
    """Hand the job the test's own session (in-memory SQLite is per-connection)."""
    @asynccontextmanager
    async def factory():
        yield session
    return factory


@pytest.mark.asyncio
async def test_hourly_refresh_syncs_fixtures(db, monkeypatch):
    db.add(Match(
        external_id="fd-1", home_team="Home FC", away_team="Away FC", stage="Group A",
        match_datetime=datetime.now(UTC) - timedelta(hours=3), status=MatchStatus.live,
    ))
    await db.commit()

    async def fake_fetch():
        return [NormalisedMatch(
            external_id="fd-1", home_team="Home FC", away_team="Away FC", stage="Group A",
            match_datetime=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3),
            venue=None, status="finished", home_score=2, away_score=1,
        )], 0

    monkeypatch.setattr("app.services.match_sync.fetch_wc_fixtures", fake_fetch)
    monkeypatch.setattr(settings, "ODDS_API_KEY", "")
    await scheduler.hourly_refresh(_factory_for(db))

    m = (await db.execute(select(Match).where(Match.external_id == "fd-1"))).scalar_one()
    assert m.home_score == 2 and m.away_score == 1 and m.status == MatchStatus.finished


@pytest.mark.asyncio
async def test_hourly_refresh_updates_odds_when_key_set(db, monkeypatch):
    dt = datetime.now(UTC) + timedelta(hours=5)
    db.add(Match(external_id="fd-2", home_team="A", away_team="B", stage="Group A",
                 match_datetime=dt, status=MatchStatus.scheduled))
    await db.commit()

    async def fake_fetch():
        return [], 0

    async def fake_odds():
        return {dt.replace(tzinfo=None): (1.5, 3.2, 6.0)}

    monkeypatch.setattr("app.services.match_sync.fetch_wc_fixtures", fake_fetch)
    monkeypatch.setattr("app.services.match_sync.fetch_wc_odds", fake_odds)
    monkeypatch.setattr(settings, "ODDS_API_KEY", "key")
    await scheduler.hourly_refresh(_factory_for(db))

    m = (await db.execute(select(Match).where(Match.external_id == "fd-2"))).scalar_one()
    assert m.home_odds == 1.5 and m.draw_odds == 3.2 and m.away_odds == 6.0


@pytest.mark.asyncio
async def test_hourly_refresh_skips_odds_without_key(db, monkeypatch):
    async def fake_fetch():
        return [], 0

    called = False

    async def fake_odds():
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr("app.services.match_sync.fetch_wc_fixtures", fake_fetch)
    monkeypatch.setattr("app.services.match_sync.fetch_wc_odds", fake_odds)
    monkeypatch.setattr(settings, "ODDS_API_KEY", "")
    await scheduler.hourly_refresh(_factory_for(db))
    assert called is False
