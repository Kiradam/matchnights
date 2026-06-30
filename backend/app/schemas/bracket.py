from pydantic import BaseModel


class BracketTeam(BaseModel):
    name: str
    tla: str | None
    crest: str | None
    score: int | None
    is_tbd: bool


class BracketMatch(BaseModel):
    id: int
    stage: str
    match_datetime: str
    status: str
    home: BracketTeam
    away: BracketTeam
    # Match in the previous round each team advanced from (by team identity).
    home_source_match_id: int | None
    away_source_match_id: int | None


class BracketRound(BaseModel):
    key: str
    name: str
    matches: list[BracketMatch]


class BracketOut(BaseModel):
    rounds: list[BracketRound]
