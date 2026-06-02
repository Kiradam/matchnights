"""Odds fetcher using the-odds-api.com free tier.

Fetches h2h (1X2) odds for WC 2026 matches and returns averaged decimal
odds keyed by UTC commence_time (rounded to nearest minute for matching).
"""
import logging
from datetime import UTC, datetime, timedelta

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.the-odds-api.com/v4/sports"
_SPORT_KEY = "soccer_fifa_world_cup"

# datetime tolerance for matching API events to DB matches (±5 min)
_MATCH_TOLERANCE = timedelta(minutes=5)


def _avg_odds(bookmakers: list[dict], outcome_name: str) -> float | None:
    prices = []
    for bm in bookmakers:
        for market in bm.get("markets", []):
            if market.get("key") != "h2h":
                continue
            for outcome in market.get("outcomes", []):
                if outcome.get("name") == outcome_name:
                    prices.append(float(outcome["price"]))
    return round(sum(prices) / len(prices), 2) if prices else None


async def fetch_wc_odds() -> dict[datetime, tuple[float | None, float | None, float | None]]:
    """Return a dict mapping match UTC datetime → (home_odds, draw_odds, away_odds).

    Uses averaged decimal odds across all available bookmakers.
    Returns an empty dict if ODDS_API_KEY is not configured or fetch fails.
    """
    if not settings.ODDS_API_KEY:
        logger.warning("ODDS_API_KEY not configured — skipping odds sync")
        return {}

    url = f"{_BASE_URL}/{_SPORT_KEY}/odds/"
    params = {
        "apiKey": settings.ODDS_API_KEY,
        "regions": "eu",
        "markets": "h2h",
        "oddsFormat": "decimal",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
    except Exception as exc:
        logger.error("Odds API fetch failed: %s", exc)
        return {}

    remaining = resp.headers.get("x-requests-remaining", "?")
    logger.info("Odds API: %s requests remaining this month", remaining)

    result: dict[datetime, tuple[float | None, float | None, float | None]] = {}
    for event in resp.json():
        try:
            commence = datetime.fromisoformat(
                event["commence_time"].replace("Z", "+00:00")
            ).astimezone(UTC).replace(tzinfo=None)

            home_team = event["home_team"]
            away_team = event["away_team"]
            bookmakers = event.get("bookmakers", [])

            home_odds = _avg_odds(bookmakers, home_team)
            draw_odds = _avg_odds(bookmakers, "Draw")
            away_odds = _avg_odds(bookmakers, away_team)

            result[commence] = (home_odds, draw_odds, away_odds)
        except Exception as exc:
            logger.warning("Odds API: skipping event: %s", exc)

    return result
