"""Shared match-sync logic used by the admin endpoint and the background scheduler.

`perform_sync` fetches fixtures from the configured data source and upserts them
into the database. It does not commit — the caller owns the transaction.
"""
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.match import Match
from app.models.sync import SyncState
from app.services.football_api import fetch_wc_fixtures

logger = logging.getLogger(__name__)

# A rescheduled match is one whose kickoff moved by more than this many seconds.
RESCHEDULE_THRESHOLD_SECONDS = 1800


async def get_or_create_sync_state(db: AsyncSession) -> SyncState:
    result = await db.execute(select(SyncState).where(SyncState.id == 1))
    state = result.scalar_one_or_none()
    if not state:
        state = SyncState(id=1)
        db.add(state)
        await db.flush()
    return state


def reset_daily_counter_if_needed(state: SyncState, now: datetime) -> None:
    today = now.strftime("%Y-%m-%d")
    if state.request_count_date != today:
        state.request_count_today = 0
        state.request_count_date = today


async def perform_sync(db: AsyncSession) -> dict:
    """Fetch fixtures and upsert them. Updates SyncState; does not commit.

    Returns a result payload dict. Raises if the upstream fetch fails.
    """
    state = await get_or_create_sync_state(db)
    now = datetime.now(UTC)
    reset_daily_counter_if_needed(state, now)

    fixtures, skipped_parse = await fetch_wc_fixtures()
    if settings.FOOTBALL_DATA_SOURCE == "api_sports":
        state.request_count_today += 1

    errors: list[str] = []
    synced = rescheduled = cancelled_count = 0
    skipped = skipped_parse

    for fix in fixtures:
        try:
            result = await db.execute(select(Match).where(Match.external_id == fix.external_id))
            existing = result.scalar_one_or_none()

            if existing:
                if abs((existing.match_datetime - fix.match_datetime).total_seconds()) > RESCHEDULE_THRESHOLD_SECONDS:
                    rescheduled += 1
                    logger.info(
                        "match rescheduled external_id=%s %s → %s",
                        fix.external_id, existing.match_datetime, fix.match_datetime,
                    )
                if existing.status.value != "cancelled" and fix.status == "cancelled":
                    cancelled_count += 1

                existing.home_team = fix.home_team
                existing.away_team = fix.away_team
                existing.stage = fix.stage
                existing.match_datetime = fix.match_datetime
                existing.venue = fix.venue
                existing.status = fix.status  # type: ignore[assignment]
                existing.last_synced_at = now
                if fix.home_team_crest:
                    existing.home_team_crest = fix.home_team_crest
                if fix.away_team_crest:
                    existing.away_team_crest = fix.away_team_crest
                existing.matchday = fix.matchday
                if fix.home_team_tla:
                    existing.home_team_tla = fix.home_team_tla
                if fix.away_team_tla:
                    existing.away_team_tla = fix.away_team_tla
                if fix.home_score is not None:
                    existing.home_score = fix.home_score
                if fix.away_score is not None:
                    existing.away_score = fix.away_score
            else:
                db.add(Match(
                    external_id=fix.external_id,
                    home_team=fix.home_team,
                    away_team=fix.away_team,
                    stage=fix.stage,
                    match_datetime=fix.match_datetime,
                    venue=fix.venue,
                    status=fix.status,  # type: ignore[arg-type]
                    last_synced_at=now,
                    home_team_crest=fix.home_team_crest,
                    away_team_crest=fix.away_team_crest,
                    matchday=fix.matchday,
                    home_team_tla=fix.home_team_tla,
                    away_team_tla=fix.away_team_tla,
                    home_score=fix.home_score,
                    away_score=fix.away_score,
                ))
            synced += 1
        except Exception as exc:
            err = f"Failed to upsert fixture {fix.external_id}: {exc}"
            logger.error(err)
            errors.append(err)
            skipped += 1

    payload = {
        "synced": synced,
        "skipped": skipped,
        "skipped_parse": skipped_parse,
        "rescheduled": rescheduled,
        "cancelled": cancelled_count,
        "quota_used_today": state.request_count_today,
        "errors": errors,
    }
    state.last_sync_at = now
    state.last_sync_result = payload
    return {**payload, "last_sync_at": now}
