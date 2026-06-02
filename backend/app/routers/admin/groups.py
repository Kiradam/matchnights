from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.group import Group, UserGroup
from app.models.preference import Preference
from app.models.user import User
from app.schemas.group import GroupCreate, GroupMemberOut, GroupOut

router = APIRouter(prefix="/admin/groups", tags=["admin"])


async def _group_out(group: Group, db: AsyncSession) -> GroupOut:
    count_result = await db.execute(
        select(func.count()).where(UserGroup.group_id == group.id)
    )
    count = count_result.scalar_one()
    return GroupOut(
        id=group.id,
        name=group.name,
        description=group.description,
        created_at=group.created_at,
        member_count=count,
    )


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: GroupCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> GroupOut:
    group = Group(name=body.name, description=body.description)
    db.add(group)
    db.add(AuditLog(actor_id=admin.id, action="group.created", target_type="group", payload={"name": body.name}))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Group name already exists")
    await db.refresh(group)
    return await _group_out(group, db)


@router.get("", response_model=list[GroupOut])
async def list_groups(
    page: int = 1,
    page_size: int = 50,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[GroupOut]:
    offset = (page - 1) * page_size
    result = await db.execute(select(Group).order_by(Group.name).offset(offset).limit(page_size))
    return [await _group_out(g, db) for g in result.scalars()]


@router.patch("/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: int,
    body: GroupCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> GroupOut:
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    group.name = body.name
    group.description = body.description
    db.add(AuditLog(actor_id=admin.id, action="group.updated", target_type="group", target_id=str(group_id)))
    await db.commit()
    await db.refresh(group)
    return await _group_out(group, db)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    # Delete preferences and memberships before removing the group
    await db.execute(delete(Preference).where(Preference.group_id == group_id))
    await db.execute(delete(UserGroup).where(UserGroup.group_id == group_id))
    db.add(AuditLog(actor_id=admin.id, action="group.deleted", target_type="group", target_id=str(group_id), payload={"name": group.name}))
    await db.delete(group)
    await db.commit()


@router.post("/{group_id}/members", status_code=status.HTTP_204_NO_CONTENT)
async def add_member(
    group_id: int,
    user_id: int = Body(..., embed=True),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    group = (await db.execute(select(Group).where(Group.id == group_id))).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    membership = UserGroup(user_id=user_id, group_id=group_id)
    db.add(membership)
    db.add(AuditLog(actor_id=admin.id, action="group.member_added", target_type="group", target_id=str(group_id), payload={"user_id": user_id}))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()  # already a member — idempotent


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: int,
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(UserGroup).where(UserGroup.group_id == group_id, UserGroup.user_id == user_id)
    )
    membership = result.scalar_one_or_none()
    if membership:
        db.add(AuditLog(actor_id=admin.id, action="group.member_removed", target_type="group", target_id=str(group_id), payload={"user_id": user_id}))
        await db.delete(membership)
        await db.commit()


@router.get("/{group_id}/members", response_model=list[GroupMemberOut])
async def list_members(
    group_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[GroupMemberOut]:
    result = await db.execute(
        select(UserGroup, User)
        .join(User, User.id == UserGroup.user_id)
        .where(UserGroup.group_id == group_id)
        .order_by(User.full_name)
    )
    return [
        GroupMemberOut(
            user_id=ug.user_id,
            full_name=u.full_name,
            email=u.email,
            is_active=u.is_active,
            added_at=ug.added_at,
        )
        for ug, u in result
    ]
