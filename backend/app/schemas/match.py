from datetime import datetime

from pydantic import BaseModel, field_serializer

from app.models.match import MatchStatus
from app.models.preference import PreferenceChoice


class MyGroupPreference(BaseModel):
    group_id: int
    group_name: str
    choice: PreferenceChoice | None


class MatchOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    external_id: str
    home_team: str
    away_team: str
    home_team_crest: str | None = None
    away_team_crest: str | None = None
    stage: str
    matchday: int | None = None
    home_odds: float | None = None
    draw_odds: float | None = None
    away_odds: float | None = None
    match_datetime: datetime
    venue: str | None
    status: MatchStatus
    my_preferences: list[MyGroupPreference] = []

    @field_serializer("match_datetime", mode="plain")
    def serialize_match_datetime(self, v: datetime) -> str:
        return v.strftime("%Y-%m-%dT%H:%M:%SZ")


class SyncResultOut(BaseModel):
    synced: int
    skipped_parse_errors: int
    rescheduled: int
    cancelled: int
    quota_used_today: int
    last_sync_at: datetime
    errors: list[str] = []
