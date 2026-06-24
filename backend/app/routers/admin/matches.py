"""Admin match sync endpoint (M4)."""
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import require_admin
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.match import Match
from app.models.user import User
from app.schemas.match import SyncResultOut
from app.services.match_sync import (
    get_or_create_sync_state,
    perform_sync,
    reset_daily_counter_if_needed,
)
from app.services.odds_api import fetch_wc_odds

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

MIN_SYNC_INTERVAL_MINUTES = 60
DAILY_QUOTA = 100  # only relevant for api_sports source


@router.post("/matches/sync", response_model=SyncResultOut)
async def sync_matches(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    state = await get_or_create_sync_state(db)
    now = datetime.now(UTC)
    reset_daily_counter_if_needed(state, now)

    # Quota guard — only enforced for api_sports (openfootball is a free GitHub fetch)
    if settings.FOOTBALL_DATA_SOURCE == "api_sports" and state.request_count_today >= DAILY_QUOTA:
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

    try:
        payload = await perform_sync(db)
    except Exception as exc:
        error_msg = f"API fetch failed: {exc}"
        logger.error(error_msg)
        state.last_sync_result = {"synced": 0, "errors": [error_msg]}
        await db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=error_msg)

    db.add(AuditLog(
        actor_id=admin.id,
        action="matches.synced",
        payload={k: v for k, v in payload.items() if k != "last_sync_at"},
    ))
    await db.commit()

    return SyncResultOut(
        synced=payload["synced"],
        skipped_parse_errors=payload["skipped_parse"],
        rescheduled=payload["rescheduled"],
        cancelled=payload["cancelled"],
        quota_used_today=payload["quota_used_today"],
        last_sync_at=payload["last_sync_at"],
        errors=payload["errors"],
    )


@router.post("/matches/sync-odds")
async def sync_odds(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Fetch 1X2 odds from the-odds-api.com and update stored matches."""

    odds_map = await fetch_wc_odds()
    if not odds_map:
        return {"updated": 0, "message": "No odds returned (check ODDS_API_KEY)"}

    result = await db.execute(select(Match))
    matches = result.scalars().all()

    updated = 0
    for match in matches:
        match_dt = match.match_datetime
        # find the closest event within tolerance
        best = min(
            odds_map.keys(),
            key=lambda dt: abs((dt - match_dt).total_seconds()),
            default=None,
        )
        if best is None:
            continue
        if abs((best - match_dt).total_seconds()) > 300:  # 5 min tolerance
            continue
        home_odds, draw_odds, away_odds = odds_map[best]
        match.home_odds = home_odds
        match.draw_odds = draw_odds
        match.away_odds = away_odds
        updated += 1

    db.add(AuditLog(actor_id=admin.id, action="matches.odds_synced", payload={"updated": updated}))
    await db.commit()
    return {"updated": updated}


@router.get("/matches/sync-state")
async def get_sync_state(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    state = await get_or_create_sync_state(db)
    await db.commit()
    return {
        "last_sync_at": state.last_sync_at,
        "last_sync_result": state.last_sync_result,
        "request_count_today": state.request_count_today,
        "quota_remaining": max(0, DAILY_QUOTA - (state.request_count_today or 0)),
    }
