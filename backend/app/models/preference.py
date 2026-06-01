import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PreferenceChoice(str, enum.Enum):
    watch = "watch"
    watch_together = "watch_together"
    skip = "skip"


class Preference(Base):
    __tablename__ = "preferences"
    __table_args__ = (UniqueConstraint("user_id", "match_id", name="uq_user_match"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"))
    choice: Mapped[PreferenceChoice] = mapped_column(Enum(PreferenceChoice))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="preferences")  # noqa: F821
    match: Mapped["Match"] = relationship("Match", back_populates="preferences")  # noqa: F821
