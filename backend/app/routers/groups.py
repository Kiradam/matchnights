from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.group import Group, UserGroup
from app.models.user import User
from app.schemas.group import GroupOut

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("/me", response_model=list[GroupOut])
async def my_groups(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GroupOut]:
    groups_result = await db.execute(
        select(Group)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == user.id)
        .order_by(Group.name)
    )
    groups = list(groups_result.scalars())
    if not groups:
        return []

    group_ids = [g.id for g in groups]
    counts_result = await db.execute(
        select(UserGroup.group_id, func.count().label("cnt"))
        .where(UserGroup.group_id.in_(group_ids))
        .group_by(UserGroup.group_id)
    )
    counts = {row.group_id: row.cnt for row in counts_result}

    return [
        GroupOut(
            id=g.id,
            name=g.name,
            description=g.description,
            created_at=g.created_at,
            member_count=counts.get(g.id, 0),
        )
        for g in groups
    ]
