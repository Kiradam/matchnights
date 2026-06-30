"""Knockout bracket endpoint.

Returns the knockout rounds (Round of 32 → Final, plus the third-place match)
with each team's feeding match in the previous round. Feeding edges are derived
by team identity — a team in a later match is linked to the earlier-round match
it actually played in — so the edges stay correct even when a tie was decided on
penalties (where the stored 90-minute score is a draw).
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.match import Match
from app.models.user import User
from app.schemas.bracket import BracketMatch, BracketOut, BracketRound, BracketTeam

router = APIRouter(prefix="/bracket", tags=["bracket"])

# (round key, display name, DB stage string) in advancing order; the final and
# third-place share the semi-finals as their previous round.
ROUND_DEFS: list[tuple[str, str, str]] = [
    ("r32", "Round of 32", "Round of 32"),
    ("r16", "Round of 16", "Round of 16"),
    ("qf", "Quarter-finals", "Quarter-finals"),
    ("sf", "Semi-finals", "Semi-finals"),
    ("final", "Final", "Final"),
    ("third", "Third place", "Third place"),
]

PREVIOUS_STAGE: dict[str, str] = {
    "r16": "Round of 32",
    "qf": "Round of 16",
    "sf": "Quarter-finals",
    "final": "Semi-finals",
    "third": "Semi-finals",
}


def _is_tbd(name: str | None) -> bool:
    return not name or name.strip().upper() == "TBD"


def _source_match_id(team_name: str | None, prev_matches: list[Match]) -> int | None:
    """Find the previous-round match the given team played in (by identity)."""
    if _is_tbd(team_name):
        return None
    target = team_name.strip().lower()  # type: ignore[union-attr]
    for m in prev_matches:
        if m.home_team.strip().lower() == target or m.away_team.strip().lower() == target:
            return m.id
    return None


@router.get("", response_model=BracketOut)
async def get_bracket(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> BracketOut:
    result = await db.execute(
        select(Match).where(Match.stage.notilike("Group %")).order_by(Match.external_id)
    )
    all_matches = list(result.scalars())

    by_stage: dict[str, list[Match]] = {}
    for m in all_matches:
        by_stage.setdefault(m.stage, []).append(m)

    rounds: list[BracketRound] = []
    for key, name, stage in ROUND_DEFS:
        stage_matches = by_stage.get(stage, [])
        prev_matches = by_stage.get(PREVIOUS_STAGE.get(key, ""), [])

        bracket_matches = [
            BracketMatch(
                id=m.id,
                stage=m.stage,
                match_datetime=m.match_datetime.strftime("%Y-%m-%dT%H:%M:%SZ"),
                status=m.status.value,
                home=BracketTeam(
                    name=m.home_team,
                    tla=m.home_team_tla,
                    crest=m.home_team_crest,
                    score=m.home_score,
                    is_tbd=_is_tbd(m.home_team),
                ),
                away=BracketTeam(
                    name=m.away_team,
                    tla=m.away_team_tla,
                    crest=m.away_team_crest,
                    score=m.away_score,
                    is_tbd=_is_tbd(m.away_team),
                ),
                home_source_match_id=_source_match_id(m.home_team, prev_matches),
                away_source_match_id=_source_match_id(m.away_team, prev_matches),
            )
            for m in stage_matches
        ]

        rounds.append(BracketRound(key=key, name=name, matches=bracket_matches))

    return BracketOut(rounds=rounds)
