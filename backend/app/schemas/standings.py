from pydantic import BaseModel


class TeamRow(BaseModel):
    position: int
    team: str
    tla: str | None
    crest: str | None
    played: int
    won: int
    drawn: int
    lost: int
    gf: int
    ga: int
    gd: int
    points: int
    status: str  # "qualified" | "eliminated" | "in_play"


class GroupMatch(BaseModel):
    id: int
    home_team: str
    home_team_tla: str | None
    home_team_crest: str | None
    away_team: str
    away_team_tla: str | None
    away_team_crest: str | None
    home_score: int | None
    away_score: int | None
    match_datetime: str
    status: str


class GroupStanding(BaseModel):
    name: str
    table: list[TeamRow]
    matches: list[GroupMatch]


class BestThirdRow(BaseModel):
    group: str
    team: str
    tla: str | None
    crest: str | None
    played: int
    gd: int
    gf: int
    points: int
    advances: bool


class StandingsOut(BaseModel):
    groups: list[GroupStanding]
    best_third: list[BestThirdRow]
