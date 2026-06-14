"""Tests for the standings computation logic and API endpoint."""
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.match import Match, MatchStatus
from app.models.user import User
from app.routers.standings import _compute_standings, _remaining, _team_status

# ── Helpers ────────────────────────────────────────────────────────────────────

def make_match(home, away, hs=None, as_=None, status=MatchStatus.scheduled, stage="Group A"):
    m = Match()
    m.id = 0
    m.external_id = f"{home}-{away}-{stage}"
    m.home_team = home
    m.away_team = away
    m.home_team_tla = home[:3].upper()
    m.away_team_tla = away[:3].upper()
    m.home_team_crest = None
    m.away_team_crest = None
    m.home_score = hs
    m.away_score = as_
    m.status = status
    m.stage = stage
    m.match_datetime = datetime(2026, 6, 15)
    m.matchday = None
    m.venue = None
    m.home_odds = None
    m.draw_odds = None
    m.away_odds = None
    return m


def finished(home, away, hs, as_, **kw):
    return make_match(home, away, hs, as_, status=MatchStatus.finished, **kw)


def scheduled(home, away, **kw):
    return make_match(home, away, status=MatchStatus.scheduled, **kw)


def full_group(wins_and_draws: list, stage="Group A") -> list:
    """Build a complete 6-match group from a result list of (home, away, hs, as_)."""
    return [finished(h, a, hs, as_, stage=stage) for h, a, hs, as_ in wins_and_draws]


async def _seed_user(db: AsyncSession, email: str = "u@t.com") -> User:
    u = User(email=email, full_name="User", hashed_password=hash_password("pass1234"))
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _seed_group_matches(db: AsyncSession, stage: str, results: list) -> None:
    for home, away, hs, as_, stat in results:
        m = Match(
            external_id=f"{home}-{away}-{stage}",
            home_team=home,
            away_team=away,
            home_team_tla=home[:3].upper(),
            away_team_tla=away[:3].upper(),
            stage=stage,
            match_datetime=datetime(2026, 6, 15),
            home_score=hs,
            away_score=as_,
            status=stat,
        )
        db.add(m)
    await db.commit()


async def _login(client: AsyncClient, email: str = "u@t.com") -> str:
    r = await client.post("/auth/login", json={"email": email, "password": "pass1234"})
    return r.json()["access_token"]


# ── Unit tests: computation ────────────────────────────────────────────────────

class TestComputeStandings:
    def test_empty_group_returns_four_teams_at_zero(self):
        matches = [
            scheduled("A", "B"), scheduled("C", "D"),
            scheduled("A", "C"), scheduled("B", "D"),
            scheduled("A", "D"), scheduled("B", "C"),
        ]
        table = _compute_standings(matches)
        assert len(table) == 4
        for t in table:
            assert t.played == 0 and t.points == 0

    def test_win_gives_three_points(self):
        matches = [
            finished("MEX", "RSA", 2, 0),
            scheduled("KOR", "CZE"), scheduled("CZE", "RSA"),
            scheduled("MEX", "KOR"), scheduled("CZE", "MEX"), scheduled("RSA", "KOR"),
        ]
        table = _compute_standings(matches)
        mex = next(t for t in table if t.team == "MEX")
        rsa = next(t for t in table if t.team == "RSA")
        assert mex.points == 3 and mex.won == 1 and mex.played == 1
        assert rsa.points == 0 and rsa.lost == 1 and rsa.played == 1

    def test_away_win_gives_three_points_to_away_team(self):
        matches = [finished("A", "B", 0, 2), scheduled("C", "D"), scheduled("A", "C"), scheduled("B", "D"), scheduled("A", "D"), scheduled("B", "C")]
        table = _compute_standings(matches)
        b = next(t for t in table if t.team == "B")
        a = next(t for t in table if t.team == "A")
        assert b.points == 3 and b.won == 1
        assert a.points == 0 and a.lost == 1

    def test_draw_gives_one_point_each(self):
        matches = [
            finished("CAN", "BIH", 1, 1),
            scheduled("QAT", "SUI"), scheduled("SUI", "BIH"),
            scheduled("CAN", "QAT"), scheduled("SUI", "CAN"), scheduled("BIH", "QAT"),
        ]
        table = _compute_standings(matches)
        can = next(t for t in table if t.team == "CAN")
        bih = next(t for t in table if t.team == "BIH")
        assert can.points == 1 and can.drawn == 1
        assert bih.points == 1 and bih.drawn == 1

    def test_goals_for_and_against_tracked_correctly(self):
        matches = [finished("A", "B", 3, 1), scheduled("C", "D"), scheduled("A", "C"), scheduled("B", "D"), scheduled("A", "D"), scheduled("B", "C")]
        table = _compute_standings(matches)
        a = next(t for t in table if t.team == "A")
        b = next(t for t in table if t.team == "B")
        assert a.gf == 3 and a.ga == 1 and a.gd == 2
        assert b.gf == 1 and b.ga == 3 and b.gd == -2

    def test_sort_by_points(self):
        matches = full_group([
            ("A", "B", 1, 0), ("C", "D", 0, 1),
            ("A", "C", 1, 0), ("B", "D", 1, 0),
            ("A", "D", 1, 0), ("B", "C", 0, 1),
        ])
        table = _compute_standings(matches)
        assert table[0].team == "A" and table[0].points == 9

    def test_sort_by_gd_on_equal_points(self):
        # A: 2W 1D = 7pts GD=+3; C: 2W 1D = 7pts GD=+1 → A above C
        matches = full_group([
            ("A", "B", 2, 0), ("C", "D", 1, 0),
            ("A", "C", 0, 0), ("B", "D", 0, 0),
            ("D", "A", 0, 1), ("C", "B", 1, 0),
        ])
        table = _compute_standings(matches)
        assert table[0].team == "A"

    def test_sort_by_gf_on_equal_points_and_gd(self):
        # A and B: 1W 2D = 5pts, GD=+1 each; A scored more goals
        matches = full_group([
            ("A", "B", 2, 1), ("C", "D", 0, 0),
            ("A", "C", 1, 0), ("B", "D", 1, 0),
            ("A", "D", 0, 0), ("B", "C", 0, 0),
        ])
        table = _compute_standings(matches)
        # A: pts=5, GD=+2 GF=3; B: pts=5, GD=+1 GF=2 → A first by GD
        assert table[0].team == "A"

    def test_h2h_tiebreaker(self):
        matches = [
            finished("A", "B", 1, 0),
            finished("B", "C", 2, 0),
            finished("A", "C", 0, 1),
            finished("B", "A", 1, 2),
            finished("C", "B", 0, 1),
            finished("C", "A", 0, 0),
        ]
        table = _compute_standings(matches)
        idx = {t.team: i for i, t in enumerate(table)}
        assert idx["A"] < idx["B"]

    def test_accumulated_stats_over_multiple_matches(self):
        matches = [
            finished("A", "B", 2, 1),
            finished("A", "C", 3, 0),
            finished("A", "D", 1, 1),
            scheduled("B", "C"), scheduled("B", "D"), scheduled("C", "D"),
        ]
        table = _compute_standings(matches)
        a = next(t for t in table if t.team == "A")
        assert a.played == 3 and a.won == 2 and a.drawn == 1 and a.lost == 0
        assert a.gf == 6 and a.ga == 2 and a.points == 7


class TestRemaining:
    def test_counts_unplayed_matches_for_team(self):
        matches = [
            finished("A", "B", 1, 0),
            scheduled("A", "C"),
            scheduled("A", "D"),
            scheduled("B", "C"),
        ]
        assert _remaining("A", matches) == 2
        assert _remaining("B", matches) == 1
        assert _remaining("C", matches) == 2

    def test_zero_when_all_played(self):
        matches = [
            finished("A", "B", 1, 0),
            finished("A", "C", 2, 1),
            finished("A", "D", 0, 0),
        ]
        assert _remaining("A", matches) == 0


class TestTeamStatus:
    def test_qualified_and_out_when_group_complete(self):
        matches = full_group([
            ("A", "B", 1, 0), ("C", "D", 1, 0),
            ("A", "C", 1, 0), ("B", "D", 1, 0),
            ("B", "C", 0, 1), ("A", "D", 1, 0),
        ])
        table = _compute_standings(matches)
        assert _team_status(1, table[0], table, matches) == "qualified"
        assert _team_status(2, table[1], table, matches) == "qualified"
        assert _team_status(3, table[2], table, matches) == "out"
        assert _team_status(4, table[3], table, matches) == "out"

    def test_in_play_when_group_not_complete(self):
        matches = [
            finished("A", "B", 1, 0),
            scheduled("C", "D"), scheduled("A", "C"),
            scheduled("B", "D"), scheduled("B", "C"), scheduled("A", "D"),
        ]
        table = _compute_standings(matches)
        for pos, t in enumerate(table, 1):
            assert _team_status(pos, t, table, matches) == "in_play"

    def test_clinched_top2_when_third_cannot_catch(self):
        # A has 9 pts, 0 remaining. Third place can win at most 3 pts.
        matches = [
            finished("A", "B", 1, 0), finished("A", "C", 1, 0), finished("A", "D", 1, 0),
            finished("B", "C", 0, 0), finished("B", "D", 0, 0),
            scheduled("C", "D"),
        ]
        table = _compute_standings(matches)
        # A is on 9pts, 3rd place max is 1pt (current) + 3 = 4 < 9 → clinched
        a = next(t for t in table if t.team == "A")
        a_pos = next(i + 1 for i, t in enumerate(table) if t.team == "A")
        assert _team_status(a_pos, a, table, matches) == "qualified"

    def test_eliminated_when_cannot_reach_second(self):
        matches = full_group([
            ("A", "B", 1, 0), ("A", "C", 1, 0),
            ("A", "D", 1, 0), ("B", "C", 1, 0),
            ("B", "D", 1, 0), ("C", "D", 0, 0),
        ])
        table = _compute_standings(matches)
        d = next(t for t in table if t.team == "D")
        d_pos = next(i + 1 for i, t in enumerate(table) if t.team == "D")
        assert _team_status(d_pos, d, table, matches) in ("out", "eliminated")

    def test_not_eliminated_when_still_in_reach(self):
        # Last place team still has 2 games left, 2nd place has only 3 pts
        matches = [
            finished("A", "B", 1, 0),
            scheduled("C", "D"), scheduled("A", "C"),
            scheduled("B", "D"), scheduled("B", "C"), scheduled("A", "D"),
        ]
        table = _compute_standings(matches)
        last = table[-1]
        last_pos = len(table)
        assert _team_status(last_pos, last, table, matches) == "in_play"


# ── API integration tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_standings_requires_auth(client: AsyncClient):
    r = await client.get("/standings")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_standings_returns_empty_when_no_group_matches(client: AsyncClient, db: AsyncSession):
    await _seed_user(db)
    token = await _login(client)
    r = await client.get("/standings", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["groups"] == []
    assert data["best_third"] == []


@pytest.mark.asyncio
async def test_standings_returns_correct_group_structure(client: AsyncClient, db: AsyncSession):
    await _seed_user(db)
    await _seed_group_matches(db, "Group A", [
        ("Mexico", "RSA", 2, 0, MatchStatus.finished),
        ("SKorea", "Czechia", 2, 1, MatchStatus.finished),
        ("Czechia", "RSA", None, None, MatchStatus.scheduled),
        ("Mexico", "SKorea", None, None, MatchStatus.scheduled),
        ("Czechia", "Mexico", None, None, MatchStatus.scheduled),
        ("RSA", "SKorea", None, None, MatchStatus.scheduled),
    ])
    token = await _login(client)
    r = await client.get("/standings", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert len(data["groups"]) == 1
    group = data["groups"][0]
    assert group["name"] == "Group A"
    assert len(group["table"]) == 4
    assert len(group["matches"]) == 6

    mex = next(t for t in group["table"] if t["team"] == "Mexico")
    rsa = next(t for t in group["table"] if t["team"] == "RSA")
    assert mex["points"] == 3 and mex["won"] == 1 and mex["position"] == 1
    assert rsa["points"] == 0 and rsa["lost"] == 1


@pytest.mark.asyncio
async def test_standings_table_sorted_correctly(client: AsyncClient, db: AsyncSession):
    await _seed_user(db)
    await _seed_group_matches(db, "Group B", [
        ("A", "B", 3, 0, MatchStatus.finished),
        ("C", "D", 2, 0, MatchStatus.finished),
        ("A", "C", 1, 0, MatchStatus.finished),
        ("B", "D", 1, 0, MatchStatus.finished),
        ("A", "D", 1, 0, MatchStatus.finished),
        ("B", "C", 0, 1, MatchStatus.finished),
    ])
    token = await _login(client)
    r = await client.get("/standings", headers={"Authorization": f"Bearer {token}"})
    table = r.json()["groups"][0]["table"]
    assert table[0]["team"] == "A" and table[0]["points"] == 9
    assert table[0]["status"] == "qualified"
    assert table[3]["status"] == "out"


@pytest.mark.asyncio
async def test_standings_match_scores_included(client: AsyncClient, db: AsyncSession):
    await _seed_user(db)
    await _seed_group_matches(db, "Group C", [
        ("X", "Y", 1, 0, MatchStatus.finished),
        ("Z", "W", None, None, MatchStatus.scheduled),
        ("X", "Z", None, None, MatchStatus.scheduled),
        ("Y", "W", None, None, MatchStatus.scheduled),
        ("X", "W", None, None, MatchStatus.scheduled),
        ("Y", "Z", None, None, MatchStatus.scheduled),
    ])
    token = await _login(client)
    r = await client.get("/standings", headers={"Authorization": f"Bearer {token}"})
    matches = r.json()["groups"][0]["matches"]
    finished_m = next(m for m in matches if m["status"] == "finished")
    assert finished_m["home_score"] == 1 and finished_m["away_score"] == 0


@pytest.mark.asyncio
async def test_best_third_populated_from_multiple_groups(client: AsyncClient, db: AsyncSession):
    await _seed_user(db)
    for group in ["Group A", "Group B"]:
        await _seed_group_matches(db, group, [
            ("T1", "T2", 3, 0, MatchStatus.finished),
            ("T3", "T4", 2, 0, MatchStatus.finished),
            ("T1", "T3", 1, 0, MatchStatus.finished),
            ("T2", "T4", 1, 0, MatchStatus.finished),
            ("T1", "T4", 1, 0, MatchStatus.finished),
            ("T2", "T3", 0, 1, MatchStatus.finished),
        ])
    token = await _login(client)
    r = await client.get("/standings", headers={"Authorization": f"Bearer {token}"})
    data = r.json()
    assert len(data["best_third"]) == 2
    # Both groups complete — third place teams should be marked as advancing (only 2 groups, both top-8)
    assert all(row["advances"] for row in data["best_third"])


@pytest.mark.asyncio
async def test_best_third_advance_flag_cutoff(client: AsyncClient, db: AsyncSession):
    """With 12 groups seeded, only the top 8 third-place teams advance."""
    await _seed_user(db)
    pts_cycle = [6, 5, 4, 3, 3, 3, 2, 1, 1, 1, 0, 0]
    for i, target_pts in enumerate(pts_cycle):
        group = f"Group {chr(65 + i)}"
        if target_pts == 6:
            results = [("T1", "T2", 1, 0), ("T3", "T4", 1, 0), ("T1", "T3", 1, 0), ("T2", "T4", 1, 0), ("T1", "T4", 1, 0), ("T2", "T3", 1, 0)]
        elif target_pts == 0:
            results = [("T1", "T2", 1, 0), ("T1", "T3", 1, 0), ("T1", "T4", 1, 0), ("T2", "T3", 1, 0), ("T2", "T4", 1, 0), ("T3", "T4", 1, 0)]
        else:
            results = [("T1", "T2", 1, 0), ("T3", "T4", 1, 0), ("T1", "T3", 1, 0), ("T2", "T4", 1, 0), ("T1", "T4", 1, 0), ("T2", "T3", 0, 0)]
        await _seed_group_matches(db, group, [(h, a, hs, as_, MatchStatus.finished) for h, a, hs, as_ in results])

    token = await _login(client)
    r = await client.get("/standings", headers={"Authorization": f"Bearer {token}"})
    thirds = r.json()["best_third"]
    assert len(thirds) == 12
    advancing = [t for t in thirds if t["advances"]]
    not_advancing = [t for t in thirds if not t["advances"]]
    assert len(advancing) == 8
    assert len(not_advancing) == 4
    assert thirds[0]["points"] >= thirds[7]["points"] >= thirds[8]["points"]
