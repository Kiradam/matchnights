from fastapi import APIRouter, Depends
from sqlalchemy import select
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
    result = await db.execute(
        select(Group)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == user.id)
        .order_by(Group.name)
    )
    groups = list(result.scalars())

    out = []
    for g in groups:
        count_result = await db.execute(
            select(UserGroup).where(UserGroup.group_id == g.id)
        )
        count = len(list(count_result.scalars()))
        out.append(GroupOut(
            id=g.id,
            name=g.name,
            description=g.description,
            created_at=g.created_at,
            member_count=count,
        ))
    return out
