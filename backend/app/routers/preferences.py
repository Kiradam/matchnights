from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.group import Group, UserGroup
from app.models.match import Match, MatchStatus
from app.models.preference import Preference, PreferenceChoice
from app.models.user import User
from app.schemas.preference import (
    GroupMemberPreference,
    GroupPreferenceSummary,
    PreferenceIn,
    PreferenceOut,
)

router = APIRouter(tags=["preferences"])


def _is_locked(match: Match) -> bool:
    return match.status in (MatchStatus.live, MatchStatus.finished)


@router.put("/matches/{match_id}/preference", response_model=PreferenceOut)
async def set_preference(
    match_id: int,
    body: PreferenceIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Preference:
    match_result = await db.execute(select(Match).where(Match.id == match_id))
    match = match_result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    if _is_locked(match):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot set preference for a live or finished match",
        )

    # Verify the user is a member of the target group
    membership = (await db.execute(
        select(UserGroup).where(
            UserGroup.user_id == user.id,
            UserGroup.group_id == body.group_id,
        )
    )).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this group")

    result = await db.execute(
        select(Preference).where(
            Preference.match_id == match_id,
            Preference.user_id == user.id,
            Preference.group_id == body.group_id,
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        pref.choice = body.choice
        pref.updated_at = datetime.now(UTC)
    else:
        pref = Preference(
            user_id=user.id,
            match_id=match_id,
            group_id=body.group_id,
            choice=body.choice,
        )
        db.add(pref)
    await db.commit()
    await db.refresh(pref)
    return pref


@router.delete("/matches/{match_id}/preference", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preference(
    match_id: int,
    group_id: int = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Preference).where(
            Preference.match_id == match_id,
            Preference.user_id == user.id,
            Preference.group_id == group_id,
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        await db.delete(pref)
        await db.commit()


@router.get("/matches/{match_id}/preferences", response_model=list[GroupPreferenceSummary])
async def get_match_preferences(
    match_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GroupPreferenceSummary]:
    if not (await db.execute(select(Match).where(Match.id == match_id))).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    # Load user's groups
    groups_result = await db.execute(
        select(UserGroup, Group)
        .join(Group, Group.id == UserGroup.group_id)
        .where(UserGroup.user_id == user.id)
        .order_by(Group.name)
    )
    user_groups = list(groups_result)

    summaries: list[GroupPreferenceSummary] = []
    for ug, group in user_groups:
        # Load all members of this group
        members_result = await db.execute(
            select(UserGroup, User)
            .join(User, User.id == UserGroup.user_id)
            .where(UserGroup.group_id == group.id)
            .order_by(User.full_name)
        )
        member_rows = list(members_result)
        member_ids = [u.id for _, u in member_rows]

        # Load all preferences for this group + match in one query
        prefs_result = await db.execute(
            select(Preference).where(
                Preference.match_id == match_id,
                Preference.group_id == group.id,
                Preference.user_id.in_(member_ids),
            )
        )
        pref_by_user: dict[int, PreferenceChoice] = {
            p.user_id: p.choice for p in prefs_result.scalars()
        }

        counts: dict[str, int] = {"watch": 0, "watch_together": 0, "skip": 0}
        no_response = 0
        members: list[GroupMemberPreference] = []

        for _, member_user in member_rows:
            choice = pref_by_user.get(member_user.id)
            if choice:
                counts[choice.value] += 1
            else:
                no_response += 1
            members.append(GroupMemberPreference(
                user_id=member_user.id,
                full_name=member_user.full_name,
                is_active=member_user.is_active,
                choice=choice,
            ))

        summaries.append(GroupPreferenceSummary(
            group_id=group.id,
            group_name=group.name,
            watch=counts["watch"],
            watch_together=counts["watch_together"],
            skip=counts["skip"],
            no_response=no_response,
            members=members,
        ))

    return summaries


@router.get("/users/me/preferences", response_model=list[PreferenceOut])
async def my_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Preference]:
    result = await db.execute(
        select(Preference).where(Preference.user_id == user.id)
    )
    return list(result.scalars())
