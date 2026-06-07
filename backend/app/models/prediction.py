import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PredictedOutcome(str, enum.Enum):
    home_win = "home_win"
    away_win = "away_win"
    draw = "draw"


class PointsReason(str, enum.Enum):
    exact_score = "exact_score"
    correct_outcome = "correct_outcome"
    wrong = "wrong"


class PredictionState(str, enum.Enum):
    tip_available = "tip_available"
    tip_locked = "tip_locked"
    evaluated = "evaluated"
    manual_review = "manual_review"


class MatchPrediction(Base):
    __tablename__ = "match_predictions"
    __table_args__ = (UniqueConstraint("user_id", "match_id", name="uq_prediction_user_match"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), index=True)

    home_goals: Mapped[int] = mapped_column(Integer)
    away_goals: Mapped[int] = mapped_column(Integer)
    predicted_outcome: Mapped[PredictedOutcome] = mapped_column(Enum(PredictedOutcome))
    # For knockout draws: team name or identifier the user expects to qualify
    predicted_qualifier: Mapped[str | None] = mapped_column(String(100), nullable=True)

    boosted: Mapped[bool] = mapped_column(Boolean, default=False)

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    points_awarded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    base_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    points_reason: Mapped[PointsReason | None] = mapped_column(
        Enum(PointsReason), nullable=True
    )

    # State of this prediction (mirrors match result availability)
    state: Mapped[PredictionState] = mapped_column(
        Enum(PredictionState), default=PredictionState.tip_available
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # noqa: F821
    match: Mapped["Match"] = relationship("Match", foreign_keys=[match_id])  # noqa: F821


class WorldCupWinnerPrediction(Base):
    __tablename__ = "world_cup_winner_predictions"
    __table_args__ = (UniqueConstraint("user_id", name="uq_winner_prediction_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, unique=True)
    # Team stored as string (team name); no separate Team model exists
    team_name: Mapped[str] = mapped_column(String(100))

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    points_awarded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # noqa: F821
