from datetime import datetime

from pydantic import BaseModel

from app.models.preference import PreferenceChoice


class PreferenceIn(BaseModel):
    choice: PreferenceChoice


class PreferenceOut(BaseModel):
    model_config = {"from_attributes": True}
    match_id: int
    choice: PreferenceChoice
    updated_at: datetime


class GroupMemberPreference(BaseModel):
    user_id: int
    full_name: str
    is_active: bool
    choice: PreferenceChoice | None


class MatchPreferenceSummary(BaseModel):
    watch: int
    watch_together: int
    skip: int
    no_response: int
    members: list[GroupMemberPreference]
