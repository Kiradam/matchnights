from datetime import datetime

from pydantic import BaseModel

from app.models.preference import PreferenceChoice


class PreferenceIn(BaseModel):
    choice: PreferenceChoice
    group_id: int


class PreferenceOut(BaseModel):
    model_config = {"from_attributes": True}
    match_id: int
    group_id: int
    choice: PreferenceChoice
    updated_at: datetime


class GroupMemberPreference(BaseModel):
    user_id: int
    full_name: str
    is_active: bool
    choice: PreferenceChoice | None


class GroupPreferenceSummary(BaseModel):
    group_id: int
    group_name: str
    watch: int
    watch_together: int
    skip: int
    no_response: int
    members: list[GroupMemberPreference]
