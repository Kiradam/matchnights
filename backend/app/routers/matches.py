from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.match import Match
from app.models.preference import Preference
from app.models.user import User
from app.schemas.match import MatchOut

router = APIRouter(prefix="/matches", tags=["matches"])


async def _attach_my_preference(
    match: Match, user: User, db: AsyncSession
) -> MatchOut:
    result = await db.execute(
        select(Preference).where(
            Preference.match_id == match.id,
            Preference.user_id == user.id,
        )
    )
    pref = result.scalar_one_or_none()
    out = MatchOut.model_validate(match)
    out.my_preference = pref.choice if pref else None
    return out


@router.get("", response_model=list[MatchOut])
async def list_matches(
    stage: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    team: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=64, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MatchOut]:
    q = select(Match).order_by(Match.match_datetime)

    if stage:
        q = q.where(Match.stage.ilike(f"%{stage}%"))
    if date_from:
        q = q.where(Match.match_datetime >= date_from)
    if date_to:
        q = q.where(Match.match_datetime <= date_to)
    if team:
        q = q.where(
            (Match.home_team.ilike(f"%{team}%")) | (Match.away_team.ilike(f"%{team}%"))
        )

    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    matches = list(result.scalars())
    return [await _attach_my_preference(m, user, db) for m in matches]


@router.get("/{match_id}", response_model=MatchOut)
async def get_match(
    match_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchOut:
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return await _attach_my_preference(match, user, db)
