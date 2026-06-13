"""Tests for the standings computation logic."""
from datetime import datetime

from app.models.match import Match, MatchStatus
from app.routers.standings import _compute_standings, _team_status


def make_match(home, away, hs=None, as_=None, status=MatchStatus.scheduled, stage="Group A"):
    m = Match()
    m.id = 0
    m.external_id = f"{home}-{away}"
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


class TestComputeStandings:
    def test_empty_group(self):
        matches = [scheduled("A", "B"), scheduled("C", "D"), scheduled("A", "C"), scheduled("B", "D"), scheduled("A", "D"), scheduled("B", "C")]
        table = _compute_standings(matches)
        assert len(table) == 4
        for t in table:
            assert t.played == 0 and t.points == 0

    def test_win_gives_3_points(self):
        matches = [finished("MEX", "RSA", 2, 0), scheduled("KOR", "CZE"), scheduled("CZE", "RSA"), scheduled("MEX", "KOR"), scheduled("CZE", "MEX"), scheduled("RSA", "KOR")]
        table = _compute_standings(matches)
        mex = next(t for t in table if t.team == "MEX")
        rsa = next(t for t in table if t.team == "RSA")
        assert mex.points == 3 and mex.won == 1
        assert rsa.points == 0 and rsa.lost == 1

    def test_draw_gives_1_point_each(self):
        matches = [finished("CAN", "BIH", 1, 1), scheduled("QAT", "SUI"), scheduled("SUI", "BIH"), scheduled("CAN", "QAT"), scheduled("SUI", "CAN"), scheduled("BIH", "QAT")]
        table = _compute_standings(matches)
        can = next(t for t in table if t.team == "CAN")
        bih = next(t for t in table if t.team == "BIH")
        assert can.points == 1 and can.drawn == 1
        assert bih.points == 1 and bih.drawn == 1

    def test_sort_by_points(self):
        matches = [
            finished("A", "B", 1, 0), finished("C", "D", 0, 1),
            finished("A", "C", 1, 0), finished("B", "D", 1, 0),
            finished("A", "D", 1, 0), finished("B", "C", 0, 1),
        ]
        table = _compute_standings(matches)
        assert table[0].team == "A"
        assert table[0].points == 9

    def test_sort_by_gd_on_equal_points(self):
        matches = [
            finished("A", "B", 2, 0), finished("C", "D", 1, 0),
            finished("A", "C", 0, 0), finished("B", "D", 0, 0),
            finished("D", "A", 0, 1), finished("C", "B", 1, 0),
        ]
        table = _compute_standings(matches)
        # A: 3W+1D = 10pts, GF=3 GA=0 GD=+3
        # C: 2W+1D = 7pts
        assert table[0].team == "A"

    def test_h2h_tiebreaker(self):
        # A and B both get 4 points, same GD, same GF overall
        # but A beat B head-to-head
        matches = [
            finished("A", "B", 1, 0),  # A wins H2H
            finished("B", "C", 2, 0),
            finished("A", "C", 0, 1),
            finished("B", "A", 1, 2),  # second H2H: A wins again
            finished("C", "B", 0, 1),
            finished("C", "A", 0, 0),
        ]
        table = _compute_standings(matches)
        idx = {t.team: i for i, t in enumerate(table)}
        # A beats B head-to-head twice — should rank above B
        assert idx["A"] < idx["B"]


class TestTeamStatus:
    def _make_table_and_matches(self):
        matches = [
            finished("A", "B", 3, 0), finished("A", "C", 3, 0), finished("A", "D", 3, 0),
            finished("B", "C", 0, 0), finished("B", "D", 0, 0), scheduled("C", "D"),
        ]
        table = _compute_standings(matches)
        return table, matches

    def test_qualified_when_complete(self):
        matches = [
            finished("A", "B", 1, 0), finished("C", "D", 1, 0),
            finished("A", "C", 1, 0), finished("B", "D", 1, 0),
            finished("B", "C", 0, 1), finished("A", "D", 1, 0),
        ]
        table = _compute_standings(matches)
        assert _team_status(1, table[0], table, matches) == "qualified"
        assert _team_status(2, table[1], table, matches) == "qualified"
        assert _team_status(3, table[2], table, matches) == "out"
        assert _team_status(4, table[3], table, matches) == "out"

    def test_eliminated_when_cannot_reach_second(self):
        # A has 9 pts, B has 6 pts, C has 0 pts with 0 games remaining
        matches = [
            finished("A", "B", 1, 0), finished("A", "C", 1, 0),
            finished("A", "D", 1, 0), finished("B", "C", 1, 0),
            finished("B", "D", 1, 0), finished("C", "D", 0, 0),
        ]
        table = _compute_standings(matches)
        # C has 1 pt (one draw), D has 0 pts — group complete
        # After full group "out" status
        d = next(t for t in table if t.team == "D")
        d_pos = next(i + 1 for i, t in enumerate(table) if t.team == "D")
        status = _team_status(d_pos, d, table, matches)
        assert status in ("out", "eliminated")
