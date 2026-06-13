from dataclasses import dataclass, field
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.match import Match
from app.models.user import User
from app.schemas.standings import BestThirdRow, GroupMatch, GroupStanding, StandingsOut, TeamRow

router = APIRouter(prefix="/standings", tags=["standings"])


@dataclass
class _TeamStats:
    team: str
    tla: str | None
    crest: str | None
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    gf: int = 0
    ga: int = 0
    points: int = 0

    @property
    def gd(self) -> int:
        return self.gf - self.ga


def _h2h_stats(teams: list[_TeamStats], matches: list[Match]) -> dict[str, tuple[int, int, int]]:
    """Return {team_name: (h2h_pts, h2h_gd, h2h_gf)} for matches among the given teams."""
    names = {t.team for t in teams}
    stats: dict[str, list[int]] = {t.team: [0, 0, 0] for t in teams}
    for m in matches:
        if m.home_team not in names or m.away_team not in names:
            continue
        if m.home_score is None or m.away_score is None:
            continue
        hs, as_ = m.home_score, m.away_score
        stats[m.home_team][1] += hs - as_
        stats[m.home_team][2] += hs
        stats[m.away_team][1] += as_ - hs
        stats[m.away_team][2] += as_
        if hs > as_:
            stats[m.home_team][0] += 3
        elif as_ > hs:
            stats[m.away_team][0] += 3
        else:
            stats[m.home_team][0] += 1
            stats[m.away_team][0] += 1
    return {k: tuple(v) for k, v in stats.items()}  # type: ignore[return-value]


def _sort_group(teams: list[_TeamStats], matches: list[Match]) -> list[_TeamStats]:
    def primary_key(t: _TeamStats) -> tuple:
        return (-t.points, -t.gd, -t.gf)

    teams = sorted(teams, key=primary_key)

    result: list[_TeamStats] = []
    i = 0
    while i < len(teams):
        j = i + 1
        while j < len(teams) and primary_key(teams[j]) == primary_key(teams[i]):
            j += 1
        tied = teams[i:j]
        if len(tied) > 1:
            h2h = _h2h_stats(tied, matches)
            tied = sorted(
                tied,
                key=lambda t: (-h2h[t.team][0], -h2h[t.team][1], -h2h[t.team][2], t.team),
            )
        result.extend(tied)
        i = j

    return result


def _remaining(team: str, matches: list[Match]) -> int:
    return sum(
        1 for m in matches
        if m.status == "scheduled"
        and (m.home_team == team or m.away_team == team)
    )


def _team_status(pos: int, team: _TeamStats, table: list[_TeamStats], matches: list[Match]) -> str:
    group_complete = all(m.status in ("finished", "cancelled") for m in matches)
    if group_complete:
        return "qualified" if pos <= 2 else "out"

    remaining = _remaining(team.team, matches)
    max_pts = team.points + remaining * 3

    if pos <= 2:
        third = table[2] if len(table) > 2 else None
        if third:
            third_max = third.points + _remaining(third.team, matches) * 3
            if third_max < team.points:
                return "qualified"
        return "in_play"

    second = table[1] if len(table) > 1 else None
    if second and max_pts < second.points:
        return "eliminated"
    return "in_play"


def _compute_standings(group_matches: list[Match]) -> list[_TeamStats]:
    teams: dict[str, _TeamStats] = {}

    for m in group_matches:
        for name, tla, crest in (
            (m.home_team, m.home_team_tla, m.home_team_crest),
            (m.away_team, m.away_team_tla, m.away_team_crest),
        ):
            if name not in teams:
                teams[name] = _TeamStats(team=name, tla=tla, crest=crest)

        if m.home_score is None or m.away_score is None:
            continue
        hs, as_ = m.home_score, m.away_score
        home, away = teams[m.home_team], teams[m.away_team]
        home.played += 1
        away.played += 1
        home.gf += hs
        home.ga += as_
        away.gf += as_
        away.ga += hs
        if hs > as_:
            home.won += 1
            home.points += 3
            away.lost += 1
        elif as_ > hs:
            away.won += 1
            away.points += 3
            home.lost += 1
        else:
            home.drawn += 1
            home.points += 1
            away.drawn += 1
            away.points += 1

    return _sort_group(list(teams.values()), group_matches)


@router.get("", response_model=StandingsOut)
async def get_standings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> StandingsOut:
    result = await db.execute(
        select(Match).where(Match.stage.ilike("Group %")).order_by(Match.match_datetime)
    )
    all_matches = list(result.scalars())

    by_group: dict[str, list[Match]] = {}
    for m in all_matches:
        by_group.setdefault(m.stage, []).append(m)

    group_standings: list[GroupStanding] = []
    all_thirds: list[BestThirdRow] = []

    for group_name in sorted(by_group):
        gmatches = by_group[group_name]
        table = _compute_standings(gmatches)

        rows = []
        for pos, t in enumerate(table, start=1):
            rows.append(TeamRow(
                position=pos,
                team=t.team,
                tla=t.tla,
                crest=t.crest,
                played=t.played,
                won=t.won,
                drawn=t.drawn,
                lost=t.lost,
                gf=t.gf,
                ga=t.ga,
                gd=t.gd,
                points=t.points,
                status=_team_status(pos, t, table, gmatches),
            ))

        if len(table) >= 3:
            third = table[2]
            all_thirds.append(BestThirdRow(
                group=group_name,
                team=third.team,
                tla=third.tla,
                crest=third.crest,
                played=third.played,
                gd=third.gd,
                gf=third.gf,
                points=third.points,
                advances=False,
            ))

        group_standings.append(GroupStanding(
            name=group_name,
            table=rows,
            matches=[
                GroupMatch(
                    id=m.id,
                    home_team=m.home_team,
                    home_team_tla=m.home_team_tla,
                    home_team_crest=m.home_team_crest,
                    away_team=m.away_team,
                    away_team_tla=m.away_team_tla,
                    away_team_crest=m.away_team_crest,
                    home_score=m.home_score,
                    away_score=m.away_score,
                    match_datetime=m.match_datetime.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    status=m.status.value,
                )
                for m in gmatches
            ],
        ))

    all_thirds.sort(key=lambda r: (-r.points, -r.gd, -r.gf))
    for i, row in enumerate(all_thirds):
        row.advances = i < 8

    return StandingsOut(groups=group_standings, best_third=all_thirds)
