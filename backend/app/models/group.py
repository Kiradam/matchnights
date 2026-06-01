from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    memberships: Mapped[list["UserGroup"]] = relationship(
        "UserGroup", back_populates="group"
    )


class UserGroup(Base):
    __tablename__ = "user_groups"
    __table_args__ = (UniqueConstraint("user_id", "group_id", name="uq_user_group"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[user_id], back_populates="group_memberships"
    )
    group: Mapped["Group"] = relationship("Group", back_populates="memberships")
