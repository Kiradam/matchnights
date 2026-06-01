from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.match import Match, MatchStatus
from app.models.preference import Preference, PreferenceChoice
from app.models.user import User
from app.schemas.preference import MatchPreferenceSummary, PreferenceIn, PreferenceOut
from app.services.visibility import get_visible_users_for_match

router = APIRouter(tags=["preferences"])


def _is_locked(match: Match) -> bool:
    """Preferences are locked once a match is live or finished."""
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

    result = await db.execute(
        select(Preference).where(
            Preference.match_id == match_id,
            Preference.user_id == user.id,
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        pref.choice = body.choice
        pref.updated_at = datetime.now(UTC)
    else:
        pref = Preference(user_id=user.id, match_id=match_id, choice=body.choice)
        db.add(pref)
    await db.commit()
    await db.refresh(pref)
    return pref


@router.delete("/matches/{match_id}/preference", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preference(
    match_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Preference).where(
            Preference.match_id == match_id,
            Preference.user_id == user.id,
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        await db.delete(pref)
        await db.commit()


@router.get("/matches/{match_id}/preferences", response_model=MatchPreferenceSummary)
async def get_match_preferences(
    match_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchPreferenceSummary:
    match_result = await db.execute(select(Match).where(Match.id == match_id))
    if not match_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    visible = await get_visible_users_for_match(db, match_id, user)

    counts = {c: 0 for c in ("watch", "watch_together", "skip")}
    no_response = 0
    members = []

    for member_user in visible:
        pref_result = await db.execute(
            select(Preference).where(
                Preference.match_id == match_id,
                Preference.user_id == member_user.id,
            )
        )
        pref = pref_result.scalar_one_or_none()
        choice = pref.choice if pref else None
        if choice:
            counts[choice.value] += 1
        else:
            no_response += 1
        members.append({
            "user_id": member_user.id,
            "full_name": member_user.full_name,
            "is_active": member_user.is_active,
            "choice": choice,
        })

    return MatchPreferenceSummary(
        watch=counts["watch"],
        watch_together=counts["watch_together"],
        skip=counts["skip"],
        no_response=no_response,
        members=members,
    )


@router.get("/users/me/preferences", response_model=list[PreferenceOut])
async def my_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Preference]:
    result = await db.execute(
        select(Preference).where(Preference.user_id == user.id)
    )
    return list(result.scalars())
