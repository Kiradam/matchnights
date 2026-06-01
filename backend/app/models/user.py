import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.user)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    group_memberships: Mapped[list["UserGroup"]] = relationship(  # noqa: F821
        "UserGroup", foreign_keys="UserGroup.user_id", back_populates="user"
    )
    preferences: Mapped[list["Preference"]] = relationship(  # noqa: F821
        "Preference", back_populates="user"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(  # noqa: F821
        "RefreshToken", back_populates="user"
    )
