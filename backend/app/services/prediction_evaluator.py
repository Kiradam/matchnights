"""Prediction evaluation service.

Scoring rules
-------------
Group stage
  - Exact result (both goals correct): 10 pts
  - Correct outcome (win/loss/draw direction): 4 pts
  - Wrong: 0 pts

Knockout stage
  - Exact 90-min result AND correct qualifier: 10 pts
  - Correct outcome (non-draw) OR (draw + correct qualifier): 4 pts
  - Incorrect qualifier: 0 pts even if score was exact

Boost: doubles points (0 stays 0).
World Cup Winner correct: 20 pts.

Boost allocations per stage
---------------------------
  Group Stage: 4
  R32: 3
  R16: 2
  QF: 1
  SF / Final / 3rd place / anything else: 0
"""

import logging
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match
from app.models.prediction import (
    MatchPrediction,
    PointsReason,
    PredictedOutcome,
    PredictionState,
    WorldCupWinnerPrediction,
)
from app.models.user import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Boost allocation
# ---------------------------------------------------------------------------

_BOOST_STAGE_MAP: dict[str, int] = {
    "group": 4,
    "r32": 3,
    "round of 32": 3,
    "r16": 2,
    "round of 16": 2,
    "qf": 1,
    "quarter-final": 1,
    "quarterfinal": 1,
    "quarter final": 1,
    "sf": 0,
    "semi-final": 0,
    "semifinal": 0,
    "semi final": 0,
    "final": 0,
    "3rd place": 0,
    "third place": 0,
}


def get_boost_allowance(stage: str) -> int:
    """Return how many boosts a user is allowed in the given stage."""
    key = stage.lower().strip()
    # Exact match first
    if key in _BOOST_STAGE_MAP:
        return _BOOST_STAGE_MAP[key]
    # Substring match
    for k, v in _BOOST_STAGE_MAP.items():
        if k in key or key in k:
            return v
    # Default: 0 (safe for playoff/final stages)
    return 0


def is_knockout_stage(stage: str) -> bool:
    """Return True if the stage is a knockout (non-group) stage."""
    key = stage.lower().strip()
    return "group" not in key


async def count_boosts_used(user_id: int, stage: str, db: AsyncSession) -> int:
    """Count boosts already committed by user_id for matches of the given stage."""
    result = await db.execute(
        select(func.count())
        .select_from(MatchPrediction)
        .join(Match, Match.id == MatchPrediction.match_id)
        .where(
            MatchPrediction.user_id == user_id,
            MatchPrediction.boosted == True,  # noqa: E712
            Match.stage == stage,
        )
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------


def _calculate_outcome(home: int, away: int) -> PredictedOutcome:
    if home > away:
        return PredictedOutcome.home_win
    if away > home:
        return PredictedOutcome.away_win
    return PredictedOutcome.draw


def _score_group(
    pred: MatchPrediction,
    home_score: int,
    away_score: int,
) -> tuple[int, PointsReason]:
    actual_outcome = _calculate_outcome(home_score, away_score)

    if pred.home_goals == home_score and pred.away_goals == away_score:
        return 10, PointsReason.exact_score

    if pred.predicted_outcome == actual_outcome:
        return 4, PointsReason.correct_outcome

    return 0, PointsReason.wrong


def _score_knockout(
    pred: MatchPrediction,
    home_score: int,
    away_score: int,
    qualifier_team_name: str | None,
) -> tuple[int, PointsReason]:
    actual_outcome = _calculate_outcome(home_score, away_score)
    exact_score = pred.home_goals == home_score and pred.away_goals == away_score

    # For draws, evaluate qualifier
    if actual_outcome == PredictedOutcome.draw:
        # Predicted draw
        if pred.predicted_outcome == PredictedOutcome.draw:
            correct_qualifier = (
                qualifier_team_name is not None
                and pred.predicted_qualifier is not None
                and qualifier_team_name.strip().lower() == pred.predicted_qualifier.strip().lower()
            )
            if exact_score and correct_qualifier:
                return 10, PointsReason.exact_score
            if correct_qualifier:
                return 4, PointsReason.correct_outcome
            return 0, PointsReason.wrong
        # Predicted non-draw for a draw match → wrong
        return 0, PointsReason.wrong

    # Actual outcome is non-draw (home_win or away_win)
    if pred.predicted_outcome == actual_outcome:
        # Qualifier doesn't matter for non-draw outcomes
        if exact_score:
            return 10, PointsReason.exact_score
        return 4, PointsReason.correct_outcome

    return 0, PointsReason.wrong


# ---------------------------------------------------------------------------
# Main evaluation function
# ---------------------------------------------------------------------------


async def evaluate_match_predictions(
    match_id: int,
    home_score: int,
    away_score: int,
    qualifier_team_name: str | None,
    db: AsyncSession,
) -> int:
    """Evaluate all predictions for a match.

    Sets points_awarded, base_points, points_reason, evaluated_at, and state
    on every MatchPrediction for the given match. Updates locked_at for
    predictions that hadn't been locked yet.

    Returns the number of predictions evaluated.
    """
    match_result = await db.execute(select(Match).where(Match.id == match_id))
    match = match_result.scalar_one_or_none()
    if match is None:
        logger.error("evaluate_match_predictions: match %d not found", match_id)
        return 0

    knockout = is_knockout_stage(match.stage)
    now = datetime.now(UTC)

    preds_result = await db.execute(
        select(MatchPrediction).where(MatchPrediction.match_id == match_id)
    )
    predictions = list(preds_result.scalars())

    for pred in predictions:
        if knockout:
            base, reason = _score_knockout(pred, home_score, away_score, qualifier_team_name)
        else:
            base, reason = _score_group(pred, home_score, away_score)

        boosted_pts = base * 2 if pred.boosted else base

        pred.base_points = base
        pred.points_awarded = boosted_pts
        pred.points_reason = reason
        pred.evaluated_at = now
        pred.state = PredictionState.evaluated
        if pred.locked_at is None:
            pred.locked_at = now

    await db.flush()
    logger.info(
        "evaluate_match_predictions: match=%d evaluated=%d predictions",
        match_id,
        len(predictions),
    )
    return len(predictions)


async def evaluate_winner_predictions(
    winning_team_name: str,
    db: AsyncSession,
) -> int:
    """Award 20 pts to any WorldCupWinnerPrediction that matches winning_team_name."""
    now = datetime.now(UTC)
    result = await db.execute(select(WorldCupWinnerPrediction))
    preds = list(result.scalars())

    evaluated = 0
    for pred in preds:
        if pred.evaluated_at is not None:
            continue  # already evaluated
        correct = pred.team_name.strip().lower() == winning_team_name.strip().lower()
        pred.points_awarded = 20 if correct else 0
        pred.evaluated_at = now
        if pred.locked_at is None:
            pred.locked_at = now
        evaluated += 1

    await db.flush()
    return evaluated
