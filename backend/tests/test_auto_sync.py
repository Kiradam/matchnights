"""Tests for the auto-sync scheduler job trigger logic."""
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.match import Match, MatchStatus
from app.models.sync import SyncState
from app.services import scheduler
from app.services.football_api import NormalisedMatch


def _factory_for(session):
    """A session_factory that hands the scheduler job the test's own session.

    The test DB is in-memory SQLite, so a second independent connection would
    not see the seeded rows — reuse the one session instead.
    """
    @asynccontextmanager
    async def factory():
        yield session
    return factory


async def _add_match(db, *, ext_id, hours_ago, home_score=None, away_score=None,
                     status=MatchStatus.scheduled):
    db.add(Match(
        external_id=ext_id,
        home_team="Home FC",
        away_team="Away FC",
        stage="Group A",
        match_datetime=datetime.now(UTC) - timedelta(hours=hours_ago),
        status=status,
        home_score=home_score,
        away_score=away_score,
    ))
    await db.commit()


@pytest.mark.asyncio
async def test_auto_sync_skips_when_no_match_recently_ended(db, monkeypatch):
    """No API call when nothing ended in the trigger window."""
    await _add_match(db, ext_id="done", hours_ago=3, home_score=1, away_score=0,
                     status=MatchStatus.finished)
    await _add_match(db, ext_id="future", hours_ago=-5)

    called = False

    async def fake_fetch():
        nonlocal called
        called = True
        return [], 0

    monkeypatch.setattr("app.services.match_sync.fetch_wc_fixtures", fake_fetch)
    await scheduler.auto_sync_finished_matches(_factory_for(db))
    assert called is False


@pytest.mark.asyncio
async def test_auto_sync_runs_when_match_ended_without_score(db, monkeypatch):
    """A match that ended in the window with no score triggers a sync that records it."""
    await _add_match(db, ext_id="fd-1", hours_ago=3, status=MatchStatus.live)

    async def fake_fetch():
        return [
            NormalisedMatch(
                external_id="fd-1",
                home_team="Home FC",
                away_team="Away FC",
                stage="Group A",
                match_datetime=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3),
                venue=None,
                status="finished",
                home_score=2,
                away_score=2,
            )
        ], 0

    monkeypatch.setattr("app.services.match_sync.fetch_wc_fixtures", fake_fetch)
    await scheduler.auto_sync_finished_matches(_factory_for(db))

    result = await db.execute(select(Match).where(Match.external_id == "fd-1"))
    m = result.scalar_one()
    assert m.home_score == 2
    assert m.away_score == 2
    assert m.status == MatchStatus.finished


@pytest.mark.asyncio
async def test_auto_sync_respects_min_interval(db, monkeypatch):
    """No API call if the last sync was too recent."""
    await _add_match(db, ext_id="fd-2", hours_ago=3, status=MatchStatus.live)
    db.add(SyncState(id=1, last_sync_at=datetime.now(UTC) - timedelta(minutes=5)))
    await db.commit()

    called = False

    async def fake_fetch():
        nonlocal called
        called = True
        return [], 0

    monkeypatch.setattr("app.services.match_sync.fetch_wc_fixtures", fake_fetch)
    await scheduler.auto_sync_finished_matches(_factory_for(db))
    assert called is False
