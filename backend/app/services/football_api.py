"""Football data client.

Three sources are supported, selected by FOOTBALL_DATA_SOURCE in settings:
  "football_data" — football-data.org free API, FOOTBALL_DATA_ORG_KEY required (default)
  "openfootball"  — free GitHub static JSON, no key required
  "api_sports"    — api-sports.io v3, requires FOOTBALL_API_KEY + paid plan for 2026
"""
import hashlib
import logging
import re
from datetime import UTC, datetime, timedelta, timezone

import httpx
from pydantic import BaseModel, ValidationError, field_validator

from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Shared normalised record ─────────────────────────────────────────────────

class NormalisedMatch:
    __slots__ = ("external_id", "home_team", "away_team", "stage",
                 "match_datetime", "venue", "status",
                 "home_team_crest", "away_team_crest")

    def __init__(
        self,
        external_id: str,
        home_team: str,
        away_team: str,
        stage: str,
        match_datetime: datetime,  # naive UTC
        venue: str | None,
        status: str,
        home_team_crest: str | None = None,
        away_team_crest: str | None = None,
    ) -> None:
        self.external_id = external_id
        self.home_team = home_team
        self.away_team = away_team
        self.stage = stage
        self.match_datetime = match_datetime
        self.venue = venue
        self.status = status
        self.home_team_crest = home_team_crest
        self.away_team_crest = away_team_crest


# ── openfootball source ──────────────────────────────────────────────────────

_OFB_URL = (
    "https://raw.githubusercontent.com/openfootball/worldcup.json"
    "/master/2026/worldcup.json"
)

# "13:00 UTC-6"  →  offset = -6
_TZ_RE = re.compile(r"UTC([+-]\d+)$")


def _parse_ofb_datetime(date_str: str, time_str: str) -> datetime:
    """Parse openfootball date + time strings to a naive UTC datetime."""
    hour, minute = map(int, time_str.split()[0].split(":"))
    m = _TZ_RE.search(time_str)
    offset_h = int(m.group(1)) if m else 0
    tz = timezone(timedelta(hours=offset_h))
    local_dt = datetime(
        *map(int, date_str.split("-")), hour, minute, tzinfo=tz
    )
    return local_dt.astimezone(UTC).replace(tzinfo=None)


def _infer_status(match_utc: datetime) -> str:
    now = datetime.now(UTC).replace(tzinfo=None)
    # Allow 115 min for a match to be considered "live" (90 min + stoppage)
    if match_utc > now + timedelta(minutes=30):
        return "scheduled"
    if match_utc > now - timedelta(minutes=115):
        return "live"
    return "finished"


def _stable_id(date: str, home: str, away: str) -> str:
    key = f"{date}|{home}|{away}"
    return "ofb-" + hashlib.sha1(key.encode()).hexdigest()[:12]


async def _fetch_openfootball() -> tuple[list[NormalisedMatch], int]:
    async with httpx.AsyncClient(timeout=30) as client:
        logger.info("openfootball fetch", extra={"url": _OFB_URL})
        response = await client.get(_OFB_URL)
        response.raise_for_status()

    raw = response.json()
    matches_raw = raw.get("matches", [])

    normalised: list[NormalisedMatch] = []
    skipped = 0
    for m in matches_raw:
        try:
            date = m["date"]
            time_str = m.get("time", "12:00 UTC+0")
            home = m["team1"]
            away = m["team2"]
            stage = m.get("group") or m.get("round", "Unknown")
            venue = m.get("ground")

            match_utc = _parse_ofb_datetime(date, time_str)
            status = _infer_status(match_utc)
            ext_id = _stable_id(date, home, away)

            normalised.append(NormalisedMatch(
                external_id=ext_id,
                home_team=home,
                away_team=away,
                stage=stage,
                match_datetime=match_utc,
                venue=venue,
                status=status,
            ))
        except Exception as exc:
            logger.warning("openfootball: skipping match due to parse error: %s", exc)
            skipped += 1

    return normalised, skipped


# ── api-sports.io source ─────────────────────────────────────────────────────

_STATUS_MAP = {
    "NS": "scheduled", "TBD": "scheduled",
    "1H": "live", "HT": "live", "2H": "live",
    "ET": "live", "BT": "live", "P": "live", "LIVE": "live",
    "FT": "finished", "AET": "finished", "PEN": "finished",
    "CANC": "cancelled", "ABD": "cancelled", "AWD": "cancelled", "WO": "cancelled",
    "PST": "scheduled",
}


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


def _normalise_api_sports(f: _Fixture) -> NormalisedMatch:
    fi = f.fixture
    if fi.date:
        try:
            match_utc = datetime.fromisoformat(fi.date).astimezone(UTC).replace(tzinfo=None)
        except ValueError:
            match_utc = datetime(2026, 6, 11)
    else:
        match_utc = datetime(2026, 6, 11)

    venue_parts = [fi.venue.name, fi.venue.city]
    venue = ", ".join(p for p in venue_parts if p) or None

    return NormalisedMatch(
        external_id=str(fi.id),
        home_team=f.teams.home.name,
        away_team=f.teams.away.name,
        stage=f.league.round,
        match_datetime=match_utc,
        venue=venue,
        status=_STATUS_MAP.get(fi.status.short, "scheduled"),
    )


async def _fetch_api_sports() -> tuple[list[NormalisedMatch], int]:
    url = f"https://{settings.FOOTBALL_API_HOST}/fixtures"
    params = {
        "league": str(settings.FOOTBALL_WC_LEAGUE_ID),
        "season": str(settings.FOOTBALL_WC_SEASON),
    }
    headers = {
        "x-apisports-key": settings.FOOTBALL_API_KEY,
        "X-RapidAPI-Key": settings.FOOTBALL_API_KEY,
        "X-RapidAPI-Host": settings.FOOTBALL_API_HOST,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        req = client.build_request("GET", url, params=params, headers=headers)
        logger.info("api_sports request", extra={"url": str(req.url)})
        response = await client.send(req)
        response.raise_for_status()

    raw = response.json()

    if raw.get("errors"):
        err_msg = "; ".join(
            f"{k}: {v}" for k, v in (
                raw["errors"].items() if isinstance(raw["errors"], dict)
                else {"error": raw["errors"]}.items()
            )
        )
        logger.error("api_sports returned errors: %s", err_msg)
        raise RuntimeError(f"API error: {err_msg}")

    try:
        parsed = _ApiResponse.model_validate(raw)
    except ValidationError as exc:
        logger.error("api_sports response validation failed: %s", exc)
        raise

    normalised: list[NormalisedMatch] = []
    skipped = 0
    for item in parsed.response:
        try:
            normalised.append(_normalise_api_sports(item))
        except Exception as exc:
            logger.warning("api_sports: skipping fixture: %s", exc)
            skipped += 1

    return normalised, skipped


# ── football-data.org source ─────────────────────────────────────────────────

_FD_URL = "https://api.football-data.org/v4/competitions/WC/matches"

_FD_STATUS_MAP = {
    "TIMED": "scheduled",
    "SCHEDULED": "scheduled",
    "POSTPONED": "scheduled",
    "IN_PLAY": "live",
    "PAUSED": "live",       # half-time
    "FINISHED": "finished",
    "AWARDED": "finished",
    "SUSPENDED": "cancelled",
    "CANCELLED": "cancelled",
}

_FD_STAGE_MAP = {
    "GROUP_STAGE": None,        # use group field instead
    "LAST_32": "Round of 32",
    "LAST_16": "Round of 16",
    "QUARTER_FINALS": "Quarter-finals",
    "SEMI_FINALS": "Semi-finals",
    "THIRD_PLACE": "Third place",
    "FINAL": "Final",
}


def _fd_stage(stage: str, group: str | None) -> str:
    if stage == "GROUP_STAGE" and group:
        # "GROUP_A" → "Group A"
        return group.replace("GROUP_", "Group ").replace("_", " ").title()
    return _FD_STAGE_MAP.get(stage, stage.replace("_", " ").title())


async def _fetch_football_data() -> tuple[list[NormalisedMatch], int]:
    if not settings.FOOTBALL_DATA_ORG_KEY:
        raise RuntimeError("FOOTBALL_DATA_ORG_KEY is not configured")

    async with httpx.AsyncClient(timeout=30) as client:
        logger.info("football_data.org fetch", extra={"url": _FD_URL})
        response = await client.get(
            _FD_URL,
            headers={"X-Auth-Token": settings.FOOTBALL_DATA_ORG_KEY},
        )
        response.raise_for_status()

    raw = response.json()
    matches_raw = raw.get("matches", [])

    normalised: list[NormalisedMatch] = []
    skipped = 0
    for m in matches_raw:
        try:
            home_obj = m.get("homeTeam") or {}
            away_obj = m.get("awayTeam") or {}
            home = home_obj.get("name") or "TBD"
            away = away_obj.get("name") or "TBD"
            home_crest = home_obj.get("crest") or None
            away_crest = away_obj.get("crest") or None
            stage = _fd_stage(m.get("stage", ""), m.get("group"))
            status = _FD_STATUS_MAP.get(m.get("status", ""), "scheduled")
            match_utc = datetime.fromisoformat(
                m["utcDate"].replace("Z", "+00:00")
            ).astimezone(UTC).replace(tzinfo=None)

            normalised.append(NormalisedMatch(
                external_id=f"fd-{m['id']}",
                home_team=home,
                away_team=away,
                stage=stage,
                match_datetime=match_utc,
                venue=None,         # not provided in free plan response
                status=status,
                home_team_crest=home_crest,
                away_team_crest=away_crest,
            ))
        except Exception as exc:
            logger.warning("football_data: skipping match: %s", exc)
            skipped += 1

    return normalised, skipped


# ── Public entry point ───────────────────────────────────────────────────────

async def fetch_wc_fixtures() -> tuple[list[NormalisedMatch], int]:
    """Fetch WC 2026 fixtures using the configured data source.

    Returns (normalised_matches, skipped_count).
    Raises on unrecoverable errors.
    """
    source = settings.FOOTBALL_DATA_SOURCE
    if source == "api_sports":
        return await _fetch_api_sports()
    if source == "openfootball":
        return await _fetch_openfootball()
    return await _fetch_football_data()
