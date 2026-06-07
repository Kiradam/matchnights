from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.prediction import PointsReason, PredictedOutcome, PredictionState


# ---------------------------------------------------------------------------
# Match Prediction
# ---------------------------------------------------------------------------


class MatchPredictionIn(BaseModel):
    """Body for PUT /predictions/{match_id}."""

    home_goals: int = Field(ge=0)
    away_goals: int = Field(ge=0)
    # Optional — required for knockout draws; validated in the router
    predicted_qualifier: str | None = None
    boosted: bool = False


class MatchPredictionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: int
    match_id: int
    home_goals: int
    away_goals: int
    predicted_outcome: PredictedOutcome
    predicted_qualifier: str | None = None
    boosted: bool
    submitted_at: datetime
    locked_at: datetime | None = None
    points_awarded: int | None = None
    base_points: int | None = None
    evaluated_at: datetime | None = None
    points_reason: PointsReason | None = None
    state: PredictionState


# ---------------------------------------------------------------------------
# World Cup Winner Prediction
# ---------------------------------------------------------------------------


class WinnerPredictionIn(BaseModel):
    """Body for PUT /predictions/winner."""

    team_name: str = Field(min_length=1, max_length=100)


class WinnerPredictionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: int
    team_name: str
    submitted_at: datetime
    locked_at: datetime | None = None
    points_awarded: int | None = None
    evaluated_at: datetime | None = None


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------


class LeaderboardEntry(BaseModel):
    user_id: int
    full_name: str
    total_points: int
    exact_score_count: int
    base_points: int


# ---------------------------------------------------------------------------
# Admin resolve
# ---------------------------------------------------------------------------


class MatchResolveIn(BaseModel):
    """Body for POST /admin/predictions/{match_id}/resolve."""

    home_score: int = Field(ge=0)
    away_score: int = Field(ge=0)
    # Team name that progressed (required for knockout draws)
    qualifier_team_name: str | None = None
