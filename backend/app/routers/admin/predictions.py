"""Admin endpoints for manual match result review and resolution."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.match import Match
from app.models.prediction import MatchPrediction, PredictionState
from app.models.user import User
from app.schemas.predictions import MatchPredictionOut, MatchResolveIn
from app.services.prediction_evaluator import evaluate_match_predictions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/predictions/manual-review")
async def list_manual_review_matches(
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List all matches that have at least one prediction in manual_review state."""
    # Find match IDs with manual_review predictions
    review_result = await db.execute(
        select(MatchPrediction.match_id)
        .where(MatchPrediction.state == PredictionState.manual_review)
        .distinct()
    )
    match_ids = [row.match_id for row in review_result]

    if not match_ids:
        return []

    matches_result = await db.execute(
        select(Match).where(Match.id.in_(match_ids)).order_by(Match.match_datetime)
    )
    matches = list(matches_result.scalars())

    out = []
    for m in matches:
        count_result = await db.execute(
            select(MatchPrediction)
            .where(
                MatchPrediction.match_id == m.id,
                MatchPrediction.state == PredictionState.manual_review,
            )
        )
        preds = list(count_result.scalars())
        out.append(
            {
                "match_id": m.id,
                "external_id": m.external_id,
                "home_team": m.home_team,
                "away_team": m.away_team,
                "stage": m.stage,
                "match_datetime": m.match_datetime.isoformat(),
                "pending_predictions": len(preds),
            }
        )
    return out


@router.post("/predictions/{match_id}/resolve", response_model=list[MatchPredictionOut])
async def resolve_match(
    match_id: int,
    body: MatchResolveIn,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[MatchPredictionOut]:
    """Admin manually enters a result for a match, triggering evaluation of all predictions."""
    match_result = await db.execute(select(Match).where(Match.id == match_id))
    match = match_result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    count = await evaluate_match_predictions(
        match_id=match_id,
        home_score=body.home_score,
        away_score=body.away_score,
        qualifier_team_name=body.qualifier_team_name,
        db=db,
    )

    db.add(
        AuditLog(
            actor_id=admin.id,
            action="predictions.resolved",
            payload={
                "match_id": match_id,
                "home_score": body.home_score,
                "away_score": body.away_score,
                "qualifier_team_name": body.qualifier_team_name,
                "predictions_evaluated": count,
            },
        )
    )

    await db.commit()

    # Return updated predictions
    preds_result = await db.execute(
        select(MatchPrediction).where(MatchPrediction.match_id == match_id)
    )
    preds = list(preds_result.scalars())
    return [MatchPredictionOut.model_validate(p) for p in preds]
