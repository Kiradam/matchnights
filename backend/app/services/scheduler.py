"""Background scheduler for MatchNights.

Jobs:
  - lock_predictions: every 5 minutes — lock tips for matches that have kicked off.
  - auto_sync_finished_matches: every 30 minutes — pull fresh fixtures when a match
    has recently ended but has no score yet (also fills in TBD knockout teams).
  - evaluate_finished_matches: every 15 minutes — auto-evaluate predictions for
    finished matches with scores; escalate to manual_review after 24h with no score.
"""
import logging
from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.match import Match
from app.models.prediction import MatchPrediction, PredictionState
from app.services.match_sync import get_or_create_sync_state, perform_sync
from app.services.prediction_evaluator import evaluate_match_predictions

logger = logging.getLogger(__name__)

# A match is "recently ended" between this many hours after kickoff (≈ full time)
# and this many hours after (matching the 24h manual-review handoff + buffer).
MATCH_ENDED_MIN_HOURS = 2
MATCH_ENDED_MAX_HOURS = 26
# Don't auto-sync more often than this, to respect upstream rate/quota limits.
AUTO_SYNC_MIN_INTERVAL_MINUTES = 30


async def lock_predictions(session_factory: async_sessionmaker) -> None:
    """Mark predictions as tip_locked for matches that have kicked off."""
    now = datetime.now(UTC)
    async with session_factory() as db:
        result = await db.execute(
            select(MatchPrediction)
            .join(Match)
            .where(
                Match.match_datetime <= now,
                MatchPrediction.state == PredictionState.tip_available,
            )
        )
        preds = list(result.scalars())
        for pred in preds:
            pred.state = PredictionState.tip_locked
            if pred.locked_at is None:
                pred.locked_at = now
        if preds:
            await db.commit()
            logger.info("lock_predictions: locked %d predictions", len(preds))


async def auto_sync_finished_matches(session_factory: async_sessionmaker) -> None:
    """Pull fresh fixtures when a match has recently ended but has no score yet.

    Only calls the upstream API when there is actually a match that ended in the
    last MATCH_ENDED_MAX_HOURS hours without a recorded score, and not more often
    than AUTO_SYNC_MIN_INTERVAL_MINUTES, so the data source's rate/quota limits
    are respected. A successful sync also fills in TBD knockout teams as a
    side effect, since it refreshes every fixture.
    """
    now = datetime.now(UTC)
    async with session_factory() as db:
        result = await db.execute(
            select(Match).where(
                or_(Match.home_score.is_(None), Match.away_score.is_(None)),
                Match.status != "cancelled",
            )
        )
        pending = list(result.scalars())

        def ended_recently(m: Match) -> bool:
            dt = m.match_datetime
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            age_h = (now - dt).total_seconds() / 3600
            return MATCH_ENDED_MIN_HOURS <= age_h <= MATCH_ENDED_MAX_HOURS

        if not any(ended_recently(m) for m in pending):
            return

        state = await get_or_create_sync_state(db)
        if state.last_sync_at:
            last = state.last_sync_at
            if last.tzinfo is None:
                last = last.replace(tzinfo=UTC)
            if (now - last).total_seconds() / 60 < AUTO_SYNC_MIN_INTERVAL_MINUTES:
                return

        try:
            payload = await perform_sync(db)
            await db.commit()
            logger.info("auto_sync_finished_matches: synced after match end: %s", payload)
        except Exception as exc:
            await db.rollback()
            logger.error("auto_sync_finished_matches failed: %s", exc)


async def evaluate_finished_matches(session_factory: async_sessionmaker) -> None:
    """Auto-evaluate predictions for finished matches that have scores.

    After 24h with no score, mark as manual_review.
    """
    now = datetime.now(UTC)
    cutoff_24h = now - timedelta(hours=24)

    async with session_factory() as db:
        match_ids_result = await db.execute(
            select(MatchPrediction.match_id)
            .where(MatchPrediction.state == PredictionState.tip_locked)
            .distinct()
        )
        match_ids = [r.match_id for r in match_ids_result]

        for match_id in match_ids:
            match_result = await db.execute(select(Match).where(Match.id == match_id))
            match = match_result.scalar_one_or_none()
            if match is None:
                continue

            if match.home_score is not None and match.away_score is not None:
                count = await evaluate_match_predictions(
                    match_id=match_id,
                    home_score=match.home_score,
                    away_score=match.away_score,
                    qualifier_team_name=None,
                    db=db,
                )
                logger.info("auto-evaluated match %d: %d predictions", match_id, count)
            else:
                match_dt = match.match_datetime
                if match_dt.tzinfo is None:
                    match_dt = match_dt.replace(tzinfo=UTC)
                if match_dt < cutoff_24h:
                    preds_result = await db.execute(
                        select(MatchPrediction).where(
                            MatchPrediction.match_id == match_id,
                            MatchPrediction.state == PredictionState.tip_locked,
                        )
                    )
                    preds = list(preds_result.scalars())
                    for pred in preds:
                        pred.state = PredictionState.manual_review
                    if preds:
                        logger.info(
                            "manual_review: match %d, %d predictions", match_id, len(preds)
                        )

        await db.commit()


def start_scheduler(session_factory: async_sessionmaker) -> AsyncIOScheduler:
    """Create and start the APScheduler with all background jobs.

    Returns the running scheduler so the caller can stop it on shutdown.
    """
    scheduler = AsyncIOScheduler()

    scheduler.add_job(
        lock_predictions,
        trigger="interval",
        minutes=5,
        args=[session_factory],
        id="lock_predictions",
        replace_existing=True,
    )

    scheduler.add_job(
        auto_sync_finished_matches,
        trigger="interval",
        minutes=AUTO_SYNC_MIN_INTERVAL_MINUTES,
        args=[session_factory],
        id="auto_sync_finished_matches",
        replace_existing=True,
    )

    scheduler.add_job(
        evaluate_finished_matches,
        trigger="interval",
        minutes=15,
        args=[session_factory],
        id="evaluate_finished_matches",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Background scheduler started")
    return scheduler


def stop_scheduler(scheduler: AsyncIOScheduler) -> None:
    """Gracefully shut down the scheduler."""
    scheduler.shutdown(wait=False)
    logger.info("Background scheduler stopped")
