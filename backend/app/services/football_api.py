"""api-football.com client with quota guard and defensive deserialization."""
import logging
from datetime import UTC, datetime

import httpx
from pydantic import BaseModel, ValidationError, field_validator

from app.core.config import settings

logger = logging.getLogger(__name__)

_STATUS_MAP = {
    # scheduled
    "NS": "scheduled", "TBD": "scheduled",
    # live
    "1H": "live", "HT": "live", "2H": "live",
    "ET": "live", "BT": "live", "P": "live", "LIVE": "live",
    # finished
    "FT": "finished", "AET": "finished", "PEN": "finished",
    # cancelled / other
    "CANC": "cancelled", "ABD": "cancelled", "AWD": "cancelled", "WO": "cancelled",
    "PST": "scheduled",  # postponed → treat as scheduled
}


# ── Defensive Pydantic models for api-football.com response ─────────────────

class _Venue(BaseModel):
    name: str | None = None
    city: str | None = None


class _Status(BaseModel):
    short: str = "NS"


class _FixtureInfo(BaseModel):
    id: int
    date: str | None = None
    venue: _Venue = _Venue()
    status: _Status = _Status()


class _Team(BaseModel):
    name: str


class _Teams(BaseModel):
    home: _Team
    away: _Team


class _League(BaseModel):
    round: str = "Unknown"


class _Fixture(BaseModel):
    fixture: _FixtureInfo
    teams: _Teams
    league: _League

    @field_validator("fixture", mode="before")
    @classmethod
    def require_fixture_id(cls, v: object) -> object:
        if isinstance(v, dict) and not v.get("id"):
            raise ValueError("fixture.id missing")
        return v


class _ApiResponse(BaseModel):
    response: list[_Fixture] = []


# ── Normalised match record ──────────────────────────────────────────────────

class NormalisedMatch:
    __slots__ = ("external_id", "home_team", "away_team", "stage",
                 "match_datetime", "venue", "status")

    def __init__(self, f: _Fixture) -> None:
        fi = f.fixture
        self.external_id = str(fi.id)
        self.home_team = f.teams.home.name
        self.away_team = f.teams.away.name
        self.stage = f.league.round

        if fi.date:
            try:
                self.match_datetime = datetime.fromisoformat(fi.date).astimezone(UTC).replace(tzinfo=None)
            except ValueError:
                self.match_datetime = datetime(2026, 6, 11, tzinfo=UTC).replace(tzinfo=None)
        else:
            self.match_datetime = datetime(2026, 6, 11, tzinfo=UTC).replace(tzinfo=None)

        venue_parts = [fi.venue.name, fi.venue.city]
        self.venue = ", ".join(p for p in venue_parts if p) or None
        self.status = _STATUS_MAP.get(fi.status.short, "scheduled")


# ── API client ───────────────────────────────────────────────────────────────

async def fetch_wc_fixtures() -> tuple[list[NormalisedMatch], int]:
    """
    Fetch WC 2026 fixtures from api-football.com.
    Returns (matches, raw_response_count).
    Raises httpx.HTTPStatusError on non-2xx.
    """
    url = f"https://{settings.FOOTBALL_API_HOST}/fixtures"
    params = {
        "league": str(settings.FOOTBALL_WC_LEAGUE_ID),
        "season": str(settings.FOOTBALL_WC_SEASON),
    }
    headers = {
        "X-RapidAPI-Key": settings.FOOTBALL_API_KEY,
        "X-RapidAPI-Host": settings.FOOTBALL_API_HOST,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = client.build_request("GET", url, params=params, headers=headers)
        logger.info("football_api request", extra={"url": str(resp.url)})
        response = await client.send(resp)
        response.raise_for_status()

    raw = response.json()

    try:
        parsed = _ApiResponse.model_validate(raw)
    except ValidationError as exc:
        logger.error("football_api response validation failed: %s", exc)
        raise

    normalised: list[NormalisedMatch] = []
    skipped = 0
    for item in parsed.response:
        try:
            normalised.append(NormalisedMatch(item))
        except Exception as exc:
            logger.warning("skipping fixture due to parse error: %s", exc)
            skipped += 1

    if skipped:
        logger.warning("skipped %d fixtures during normalisation", skipped)

    return normalised, skipped
