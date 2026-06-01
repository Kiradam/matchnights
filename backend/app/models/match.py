import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MatchStatus(str, enum.Enum):
    scheduled = "scheduled"
    live = "live"
    finished = "finished"
    cancelled = "cancelled"


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    home_team: Mapped[str] = mapped_column(String(100))
    away_team: Mapped[str] = mapped_column(String(100))
    stage: Mapped[str] = mapped_column(String(100))
    match_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    venue: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus), default=MatchStatus.scheduled
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    preferences: Mapped[list["Preference"]] = relationship(  # noqa: F821
        "Preference", back_populates="match"
    )
