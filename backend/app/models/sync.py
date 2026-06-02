from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SyncState(Base):
    """Single-row table tracking match sync metadata."""
    __tablename__ = "sync_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    request_count_today: Mapped[int] = mapped_column(Integer, default=0)
    request_count_date: Mapped[str | None] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD
