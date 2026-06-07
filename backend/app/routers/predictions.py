"""Prediction endpoints for MatchNights."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.group import UserGroup
from app.models.match import Match
from app.models.prediction import (
    MatchPrediction,
    PredictedOutcome,
    PredictionState,
    WorldCupWinnerPrediction,
)
from app.models.user import User
from app.schemas.predictions import (
    LeaderboardEntry,
    MatchPredictionIn,
    MatchPredictionOut,
    MatchPredictionStats,
    OutcomeCounts,
    PredictedScore,
    WinnerPredictionIn,
    WinnerPredictionOut,
)
from app.services.prediction_evaluator import (
    count_boosts_used,
    get_boost_allowance,
    is_knockout_stage,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["predictions"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

KNOCKOUT_LOCK_STAGES = {"R32", "Round of 32", "R16", "Round of 16", "QF", "Quarter-Final",
                         "SF", "Semi-Final", "Final", "3rd Place"}


def _calc_outcome(home: int, away: int) -> PredictedOutcome:
    if home > away:
        return PredictedOutcome.home_win
    if away > home:
        return PredictedOutcome.away_win
    return PredictedOutcome.draw


async def _get_winner_lock_deadline(db: AsyncSession) -> datetime | None:
    """Return the kickoff of the earliest knockout-stage match."""
    result = await db.execute(
        select(func.min(Match.match_datetime)).where(
            Match.stage.notilike("%group%")
        )
    )
    return result.scalar_one_or_none()


async def _build_leaderboard(user_ids: list[int], db: AsyncSession) -> list[LeaderboardEntry]:
    if not user_ids:
        return []

    # Use two separate queries to avoid SQLite CASE-in-aggregate complexity.

    # Query 1: total points and base points
    pts_rows = await db.execute(
        select(
            MatchPrediction.user_id,
            func.coalesce(func.sum(MatchPrediction.points_awarded), 0).label("total_points"),
            func.coalesce(func.sum(MatchPrediction.base_points), 0).label("base_pts"),
        )
        .where(
            MatchPrediction.user_id.in_(user_ids),
            MatchPrediction.state == PredictionState.evaluated,
        )
        .group_by(MatchPrediction.user_id)
    )
    pts_map: dict[int, tuple[int, int]] = {
        row.user_id: (row.total_points, row.base_pts) for row in pts_rows
    }

    # Query 2: exact score counts
    exact_rows = await db.execute(
        select(
            MatchPrediction.user_id,
            func.count().label("cnt"),
        )
        .where(
            MatchPrediction.user_id.in_(user_ids),
            MatchPrediction.state == PredictionState.evaluated,
            MatchPrediction.points_reason == "exact_score",
        )
        .group_by(MatchPrediction.user_id)
    )
    exact_map: dict[int, int] = {row.user_id: row.cnt for row in exact_rows}

    # Fetch user names
    users_result = await db.execute(
        select(User.id, User.full_name).where(User.id.in_(user_ids))
    )
    name_map: dict[int, str] = {row.id: row.full_name for row in users_result}

    entries: list[LeaderboardEntry] = []
    for uid in user_ids:
        total, base = pts_map.get(uid, (0, 0))
        exact = exact_map.get(uid, 0)
        entries.append(
            LeaderboardEntry(
                user_id=uid,
                full_name=name_map.get(uid, "Unknown"),
                total_points=total,
                exact_score_count=exact,
                base_points=base,
            )
        )

    # Sort: 1) total_points desc, 2) exact_score_count desc, 3) base_points desc
    entries.sort(key=lambda e: (-e.total_points, -e.exact_score_count, -e.base_points))
    return entries


# ---------------------------------------------------------------------------
# Winner prediction — fixed paths must come before /{match_id} routes
# ---------------------------------------------------------------------------


@router.get("/predictions/winner", response_model=WinnerPredictionOut)
async def get_winner_prediction(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WinnerPredictionOut:
    result = await db.execute(
        select(WorldCupWinnerPrediction).where(WorldCupWinnerPrediction.user_id == user.id)
    )
    pred = result.scalar_one_or_none()
    if not pred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No winner prediction found")
    return WinnerPredictionOut.model_validate(pred)


@router.put("/predictions/winner", response_model=WinnerPredictionOut)
async def upsert_winner_prediction(
    body: WinnerPredictionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WinnerPredictionOut:
    # Deadline: kickoff of earliest knockout-stage match
    deadline = await _get_winner_lock_deadline(db)
    now = datetime.now(UTC)

    if deadline is not None:
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=UTC)
        if now >= deadline:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="World Cup Winner prediction is locked — knockout stage has started",
            )

    result = await db.execute(
        select(WorldCupWinnerPrediction).where(WorldCupWinnerPrediction.user_id == user.id)
    )
    pred = result.scalar_one_or_none()

    if pred is None:
        pred = WorldCupWinnerPrediction(
            user_id=user.id,
            team_name=body.team_name,
            submitted_at=now,
        )
        db.add(pred)
    else:
        pred.team_name = body.team_name
        pred.submitted_at = now

    await db.commit()
    return WinnerPredictionOut.model_validate(pred)


# ---------------------------------------------------------------------------
# Match predictions
# ---------------------------------------------------------------------------


@router.put("/predictions/{match_id}", response_model=MatchPredictionOut)
async def upsert_prediction(
    match_id: int,
    body: MatchPredictionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchPredictionOut:
    # Load match
    match_result = await db.execute(select(Match).where(Match.id == match_id))
    match = match_result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    # Deadline check
    now = datetime.now(UTC)
    kickoff = match.match_datetime
    if kickoff.tzinfo is None:
        kickoff = kickoff.replace(tzinfo=UTC)
    if now >= kickoff:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prediction deadline has passed — match has already kicked off",
        )

    # Calculate outcome
    outcome = _calc_outcome(body.home_goals, body.away_goals)

    # Knockout + draw → qualifier required
    knockout = is_knockout_stage(match.stage)
    if knockout and outcome == PredictedOutcome.draw:
        if not body.predicted_qualifier:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="predicted_qualifier is required for knockout stage draws",
            )

    # Boost validation
    if body.boosted:
        allowance = get_boost_allowance(match.stage)
        if allowance == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Boosts are not available for stage '{match.stage}'",
            )
        used = await count_boosts_used(user.id, match.stage, db)
        # Check existing prediction to not double-count current match's boost
        existing_check = await db.execute(
            select(MatchPrediction).where(
                MatchPrediction.user_id == user.id,
                MatchPrediction.match_id == match_id,
            )
        )
        current_pred = existing_check.scalar_one_or_none()
        # If editing and it was already boosted, that boost is already counted
        already_boosted_here = current_pred is not None and current_pred.boosted
        # If not already boosted on this match, adding one more
        if not already_boosted_here and used >= allowance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Boost limit reached for stage '{match.stage}' "
                    f"({allowance} allowed, {used} used)"
                ),
            )

    # Upsert
    existing_result = await db.execute(
        select(MatchPrediction).where(
            MatchPrediction.user_id == user.id,
            MatchPrediction.match_id == match_id,
        )
    )
    pred = existing_result.scalar_one_or_none()

    if pred is None:
        pred = MatchPrediction(
            user_id=user.id,
            match_id=match_id,
            home_goals=body.home_goals,
            away_goals=body.away_goals,
            predicted_outcome=outcome,
            predicted_qualifier=body.predicted_qualifier if (knockout and outcome == PredictedOutcome.draw) else None,
            boosted=body.boosted,
            submitted_at=now,
            state=PredictionState.tip_available,
        )
        db.add(pred)
    else:
        pred.home_goals = body.home_goals
        pred.away_goals = body.away_goals
        pred.predicted_outcome = outcome
        pred.predicted_qualifier = body.predicted_qualifier if (knockout and outcome == PredictedOutcome.draw) else None
        pred.boosted = body.boosted
        pred.submitted_at = now

    await db.commit()
    return MatchPredictionOut.model_validate(pred)


@router.get("/predictions/match/{match_id}/stats", response_model=MatchPredictionStats)
async def get_match_prediction_stats(
    match_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchPredictionStats:
    """Return aggregate prediction distribution for a match (available after kickoff)."""
    match_result = await db.execute(select(Match).where(Match.id == match_id))
    match = match_result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    now = datetime.now(UTC)
    kickoff = match.match_datetime
    if kickoff.tzinfo is None:
        kickoff = kickoff.replace(tzinfo=UTC)
    if now < kickoff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Prediction distribution is not visible before kickoff",
        )

    preds_result = await db.execute(
        select(MatchPrediction).where(MatchPrediction.match_id == match_id)
    )
    preds = list(preds_result.scalars())

    outcome_counts = OutcomeCounts(home_win=0, draw=0, away_win=0)
    score_tally: dict[tuple[int, int], int] = {}
    for pred in preds:
        if pred.predicted_outcome == PredictedOutcome.home_win:
            outcome_counts.home_win += 1
        elif pred.predicted_outcome == PredictedOutcome.draw:
            outcome_counts.draw += 1
        else:
            outcome_counts.away_win += 1
        key = (pred.home_goals, pred.away_goals)
        score_tally[key] = score_tally.get(key, 0) + 1

    top_scores = [
        PredictedScore(home=h, away=a, count=c)
        for (h, a), c in sorted(score_tally.items(), key=lambda x: -x[1])[:6]
    ]

    return MatchPredictionStats(
        match_id=match_id,
        total=len(preds),
        outcome_counts=outcome_counts,
        top_scores=top_scores,
    )


@router.get("/predictions/{match_id}", response_model=MatchPredictionOut)
async def get_prediction(
    match_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchPredictionOut:
    result = await db.execute(
        select(MatchPrediction).where(
            MatchPrediction.user_id == user.id,
            MatchPrediction.match_id == match_id,
        )
    )
    pred = result.scalar_one_or_none()
    if not pred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No prediction found")
    return MatchPredictionOut.model_validate(pred)


@router.get("/predictions", response_model=list[MatchPredictionOut])
async def list_my_predictions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MatchPredictionOut]:
    result = await db.execute(
        select(MatchPrediction)
        .where(MatchPrediction.user_id == user.id)
        .order_by(MatchPrediction.submitted_at.desc())
    )
    preds = list(result.scalars())
    return [MatchPredictionOut.model_validate(p) for p in preds]


# ---------------------------------------------------------------------------
# Leaderboards
# ---------------------------------------------------------------------------


@router.get("/leaderboard/global", response_model=list[LeaderboardEntry])
async def global_leaderboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LeaderboardEntry]:
    users_result = await db.execute(select(User.id).where(User.is_active == True))  # noqa: E712
    user_ids = [row.id for row in users_result]
    return await _build_leaderboard(user_ids, db)


@router.get("/leaderboard/group/{group_id}", response_model=list[LeaderboardEntry])
async def group_leaderboard(
    group_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LeaderboardEntry]:
    # Check membership
    membership_result = await db.execute(
        select(UserGroup).where(
            UserGroup.user_id == user.id,
            UserGroup.group_id == group_id,
        )
    )
    if not membership_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group",
        )

    members_result = await db.execute(
        select(UserGroup.user_id).where(UserGroup.group_id == group_id)
    )
    user_ids = [row.user_id for row in members_result]
    return await _build_leaderboard(user_ids, db)
