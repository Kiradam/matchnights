from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.group import Group, UserGroup
from app.models.match import Match
from app.models.preference import Preference
from app.models.user import User
from app.schemas.match import MatchOut, MyGroupPreference

router = APIRouter(prefix="/matches", tags=["matches"])


async def _build_match_out(
    matches: list[Match],
    user: User,
    db: AsyncSession,
) -> list[MatchOut]:
    # Load user's groups once
    groups_result = await db.execute(
        select(UserGroup, Group)
        .join(Group, Group.id == UserGroup.group_id)
        .where(UserGroup.user_id == user.id)
        .order_by(Group.name)
    )
    user_group_rows = list(groups_result)
    group_names: dict[int, str] = {ug.group_id: g.name for ug, g in user_group_rows}

    # Load all preferences for these matches in one query
    match_ids = [m.id for m in matches]
    pref_map: dict[tuple[int, int], str] = {}
    if match_ids and group_names:
        prefs_result = await db.execute(
            select(Preference).where(
                Preference.user_id == user.id,
                Preference.match_id.in_(match_ids),
            )
        )
        pref_map = {(p.match_id, p.group_id): p.choice for p in prefs_result.scalars()}

    out: list[MatchOut] = []
    for m in matches:
        mo = MatchOut.model_validate(m)
        mo.my_preferences = [
            MyGroupPreference(
                group_id=gid,
                group_name=gname,
                choice=pref_map.get((m.id, gid)),
            )
            for gid, gname in group_names.items()
        ]
        out.append(mo)
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
    return await _build_match_out(matches, user, db)


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
    built = await _build_match_out([match], user, db)
    return built[0]
