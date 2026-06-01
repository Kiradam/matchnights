from datetime import datetime

from pydantic import BaseModel, field_validator


class GroupCreate(BaseModel):
    name: str
    description: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()


class GroupOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    description: str | None
    created_at: datetime
    member_count: int = 0


class GroupMemberOut(BaseModel):
    model_config = {"from_attributes": True}

    user_id: int
    full_name: str
    email: str
    is_active: bool
    added_at: datetime
