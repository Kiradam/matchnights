from datetime import datetime

from pydantic import BaseModel

from app.models.match import MatchStatus
from app.models.preference import PreferenceChoice


class MatchOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    external_id: str
    home_team: str
    away_team: str
    stage: str
    match_datetime: datetime
    venue: str | None
    status: MatchStatus
    my_preference: PreferenceChoice | None = None


class SyncResultOut(BaseModel):
    synced: int
    skipped_parse_errors: int
    rescheduled: int
    cancelled: int
    quota_used_today: int
    last_sync_at: datetime
    errors: list[str] = []
