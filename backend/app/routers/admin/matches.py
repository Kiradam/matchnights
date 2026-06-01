"""Admin match sync endpoint (M4)."""
import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.match import Match
from app.models.sync import SyncState
from app.models.user import User
from app.schemas.match import SyncResultOut
from app.services.football_api import fetch_wc_fixtures

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

MIN_SYNC_INTERVAL_MINUTES = 60  # configurable; refuse sync if last was < this ago
DAILY_QUOTA = 100


async def _get_or_create_sync_state(db: AsyncSession) -> SyncState:
    result = await db.execute(select(SyncState).where(SyncState.id == 1))
    state = result.scalar_one_or_none()
    if not state:
        state = SyncState(id=1)
        db.add(state)
        await db.flush()
    return state


@router.post("/matches/sync", response_model=SyncResultOut)
async def sync_matches(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    state = await _get_or_create_sync_state(db)
    now = datetime.now(UTC)
    today = now.strftime("%Y-%m-%d")

    # Reset daily counter if date has changed
    if state.request_count_date != today:
        state.request_count_today = 0
        state.request_count_date = today

    # Quota guard
    if state.request_count_today >= DAILY_QUOTA:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily API quota of {DAILY_QUOTA} requests exhausted. Try again tomorrow.",
        )

    # Rate guard: don't sync more often than MIN_SYNC_INTERVAL_MINUTES
    if state.last_sync_at:
        last = state.last_sync_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=UTC)
        elapsed = (now - last).total_seconds() / 60
        if elapsed < MIN_SYNC_INTERVAL_MINUTES:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Last sync was {elapsed:.0f} min ago. Wait at least {MIN_SYNC_INTERVAL_MINUTES} min between syncs.",
            )

    errors: list[str] = []
    synced = skipped = rescheduled = cancelled_count = 0

    try:
        fixtures, skipped_parse = await fetch_wc_fixtures()
        state.request_count_today += 1
        skipped += skipped_parse
    except Exception as exc:
        error_msg = f"API fetch failed: {exc}"
        logger.error(error_msg)
        errors.append(error_msg)
        state.last_sync_result = {"synced": 0, "errors": errors}
        await db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=error_msg)

    # Upsert inside a single transaction — all-or-nothing (issue #94)
    for fix in fixtures:
        try:
            result = await db.execute(select(Match).where(Match.external_id == fix.external_id))
            existing = result.scalar_one_or_none()

            if existing:
                old_dt = existing.match_datetime
                new_dt = fix.match_datetime
                if abs((old_dt - new_dt).total_seconds()) > 1800:
                    rescheduled += 1
                    logger.info(
                        "match rescheduled external_id=%s %s → %s",
                        fix.external_id, old_dt, new_dt,
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
            else:
                match = Match(
                    external_id=fix.external_id,
                    home_team=fix.home_team,
                    away_team=fix.away_team,
                    stage=fix.stage,
                    match_datetime=fix.match_datetime,
                    venue=fix.venue,
                    status=fix.status,  # type: ignore[arg-type]
                    last_synced_at=now,
                )
                db.add(match)
            synced += 1
        except Exception as exc:
            err = f"Failed to upsert fixture {fix.external_id}: {exc}"
            logger.error(err)
            errors.append(err)
            skipped += 1

    result_payload = {
        "synced": synced, "skipped": skipped + skipped_parse,
        "rescheduled": rescheduled, "cancelled": cancelled_count,
        "quota_used_today": state.request_count_today,
        "errors": errors,
    }
    state.last_sync_at = now
    state.last_sync_result = result_payload

    db.add(AuditLog(
        actor_id=admin.id,
        action="matches.synced",
        payload=result_payload,
    ))
    await db.commit()

    return SyncResultOut(
        synced=synced,
        skipped_parse_errors=skipped_parse,
        rescheduled=rescheduled,
        cancelled=cancelled_count,
        quota_used_today=state.request_count_today,
        last_sync_at=now,
        errors=errors,
    )


@router.get("/matches/sync-state")
async def get_sync_state(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    state = await _get_or_create_sync_state(db)
    await db.commit()
    return {
        "last_sync_at": state.last_sync_at,
        "last_sync_result": state.last_sync_result,
        "request_count_today": state.request_count_today,
        "quota_remaining": max(0, DAILY_QUOTA - (state.request_count_today or 0)),
    }
