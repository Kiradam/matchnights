from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.models.user import UserRole


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class UserUpdateMe(BaseModel):
    full_name: str | None = None
    current_password: str | None = None
    new_password: str | None = None

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 8:
            raise ValueError("new_password must be at least 8 characters")
        return v


class InviteOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    token: str
    registration_url: str
    expires_at: datetime
    created_at: datetime
    use_count: int
    max_uses: int


class CreateInviteRequest(BaseModel):
    expires_in_hours: int | None = None
