"""Background scheduler for MatchNights.

Jobs:
  - lock_predictions: every 5 minutes — lock tips for matches that have kicked off.
  - evaluate_finished_matches: every 15 minutes — auto-evaluate predictions for
    finished matches with scores; escalate to manual_review after 24h with no score.
"""
import logging
from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.match import Match
from app.models.prediction import MatchPrediction, PredictionState
from app.services.prediction_evaluator import evaluate_match_predictions

logger = logging.getLogger(__name__)


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
