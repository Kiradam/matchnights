"""Unit and integration tests for the prediction scoring and evaluator service."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.match import Match, MatchStatus
from app.models.prediction import (
    MatchPrediction,
    PointsReason,
    PredictedOutcome,
    PredictionState,
    WorldCupWinnerPrediction,
)
from app.models.user import User
from app.services.prediction_evaluator import (
    _score_group,
    _score_knockout,
    evaluate_match_predictions,
    evaluate_winner_predictions,
    get_boost_allowance,
    is_knockout_stage,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _pred(home: int, away: int, outcome: PredictedOutcome, qualifier: str | None = None, boosted: bool = False) -> SimpleNamespace:
    """Build a lightweight namespace for testing the pure scoring functions."""
    return SimpleNamespace(
        home_goals=home,
        away_goals=away,
        predicted_outcome=outcome,
        predicted_qualifier=qualifier,
        boosted=boosted,
    )


async def _make_user(db: AsyncSession, email: str = "u@t.com") -> User:
    u = User(email=email, full_name="Test", hashed_password=hash_password("x"))
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _make_match(db: AsyncSession, stage: str = "Group A", past: bool = True, ext_id: str = "ext1") -> Match:
    dt = datetime.now(UTC) + timedelta(hours=-2 if past else 2)
    m = Match(
        external_id=ext_id,
        home_team="Home",
        away_team="Away",
        stage=stage,
        match_datetime=dt,
        status=MatchStatus.finished if past else MatchStatus.scheduled,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


async def _make_prediction(
    db: AsyncSession,
    user: User,
    match: Match,
    home: int,
    away: int,
    qualifier: str | None = None,
    boosted: bool = False,
) -> MatchPrediction:
    outcome = (
        PredictedOutcome.home_win if home > away
        else PredictedOutcome.away_win if away > home
        else PredictedOutcome.draw
    )
    p = MatchPrediction(
        user_id=user.id,
        match_id=match.id,
        home_goals=home,
        away_goals=away,
        predicted_outcome=outcome,
        predicted_qualifier=qualifier,
        boosted=boosted,
        submitted_at=datetime.now(UTC),
        state=PredictionState.tip_locked,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


# ---------------------------------------------------------------------------
# get_boost_allowance
# ---------------------------------------------------------------------------


def test_boost_allowance_group():
    assert get_boost_allowance("Group A") == 4
    assert get_boost_allowance("group b") == 4


def test_boost_allowance_r32():
    assert get_boost_allowance("R32") == 3
    assert get_boost_allowance("Round of 32") == 3


def test_boost_allowance_r16():
    assert get_boost_allowance("R16") == 2
    assert get_boost_allowance("Round of 16") == 2


def test_boost_allowance_qf():
    assert get_boost_allowance("QF") == 1
    assert get_boost_allowance("Quarter-Final") == 1


def test_boost_allowance_sf():
    assert get_boost_allowance("SF") == 0
    assert get_boost_allowance("Semi-Final") == 0


def test_boost_allowance_final():
    assert get_boost_allowance("Final") == 0
    assert get_boost_allowance("3rd Place") == 0


def test_boost_allowance_unknown_defaults_zero():
    assert get_boost_allowance("Playoff A") == 0


# ---------------------------------------------------------------------------
# is_knockout_stage
# ---------------------------------------------------------------------------


def test_is_knockout_group_stages():
    assert is_knockout_stage("Group A") is False
    assert is_knockout_stage("GROUP B") is False
    assert is_knockout_stage("group stage") is False


def test_is_knockout_knockout_stages():
    assert is_knockout_stage("R16") is True
    assert is_knockout_stage("Quarter-Final") is True
    assert is_knockout_stage("Semi-Final") is True
    assert is_knockout_stage("Final") is True
    assert is_knockout_stage("3rd Place") is True


# ---------------------------------------------------------------------------
# _score_group
# ---------------------------------------------------------------------------


def test_score_group_exact_score():
    p = _pred(2, 1, PredictedOutcome.home_win)
    pts, reason = _score_group(p, 2, 1)
    assert pts == 10
    assert reason == PointsReason.exact_score


def test_score_group_correct_outcome_home_win():
    p = _pred(1, 0, PredictedOutcome.home_win)
    pts, reason = _score_group(p, 3, 0)
    assert pts == 4
    assert reason == PointsReason.correct_outcome


def test_score_group_correct_outcome_draw():
    p = _pred(1, 1, PredictedOutcome.draw)
    pts, reason = _score_group(p, 0, 0)
    assert pts == 4
    assert reason == PointsReason.correct_outcome


def test_score_group_correct_outcome_away_win():
    p = _pred(0, 2, PredictedOutcome.away_win)
    pts, reason = _score_group(p, 0, 1)
    assert pts == 4
    assert reason == PointsReason.correct_outcome


def test_score_group_wrong():
    p = _pred(2, 0, PredictedOutcome.home_win)
    pts, reason = _score_group(p, 0, 1)
    assert pts == 0
    assert reason == PointsReason.wrong


def test_score_group_wrong_draw_predicted_but_home_won():
    p = _pred(1, 1, PredictedOutcome.draw)
    pts, reason = _score_group(p, 2, 0)
    assert pts == 0
    assert reason == PointsReason.wrong


# ---------------------------------------------------------------------------
# _score_knockout — non-draw outcomes
# ---------------------------------------------------------------------------


def test_score_knockout_non_draw_exact():
    p = _pred(2, 0, PredictedOutcome.home_win)
    pts, reason = _score_knockout(p, 2, 0, None)
    assert pts == 10
    assert reason == PointsReason.exact_score


def test_score_knockout_non_draw_correct_outcome():
    p = _pred(1, 0, PredictedOutcome.home_win)
    pts, reason = _score_knockout(p, 3, 1, None)
    assert pts == 4
    assert reason == PointsReason.correct_outcome


def test_score_knockout_non_draw_wrong_outcome():
    p = _pred(0, 2, PredictedOutcome.away_win)
    pts, reason = _score_knockout(p, 2, 0, None)
    assert pts == 0
    assert reason == PointsReason.wrong


# ---------------------------------------------------------------------------
# _score_knockout — draw outcomes (qualifier matters)
# ---------------------------------------------------------------------------


def test_score_knockout_draw_exact_and_correct_qualifier():
    p = _pred(1, 1, PredictedOutcome.draw, qualifier="Argentina")
    pts, reason = _score_knockout(p, 1, 1, "Argentina")
    assert pts == 10
    assert reason == PointsReason.exact_score


def test_score_knockout_draw_score_mismatch_but_correct_qualifier():
    p = _pred(0, 0, PredictedOutcome.draw, qualifier="Argentina")
    pts, reason = _score_knockout(p, 1, 1, "Argentina")
    assert pts == 4
    assert reason == PointsReason.correct_outcome


def test_score_knockout_draw_exact_score_wrong_qualifier():
    p = _pred(1, 1, PredictedOutcome.draw, qualifier="Brazil")
    pts, reason = _score_knockout(p, 1, 1, "Argentina")
    assert pts == 0
    assert reason == PointsReason.wrong


def test_score_knockout_draw_qualifier_case_insensitive():
    p = _pred(1, 1, PredictedOutcome.draw, qualifier="argentina")
    pts, reason = _score_knockout(p, 1, 1, "Argentina")
    assert pts == 10
    assert reason == PointsReason.exact_score


def test_score_knockout_draw_predicted_non_draw_for_actual_draw():
    p = _pred(2, 0, PredictedOutcome.home_win)
    pts, reason = _score_knockout(p, 1, 1, "Argentina")
    assert pts == 0
    assert reason == PointsReason.wrong


def test_score_knockout_actual_draw_no_qualifier_provided():
    p = _pred(1, 1, PredictedOutcome.draw, qualifier="Brazil")
    pts, reason = _score_knockout(p, 1, 1, None)
    # qualifier_team_name is None → no correct qualifier
    assert pts == 0
    assert reason == PointsReason.wrong


# ---------------------------------------------------------------------------
# evaluate_match_predictions — group stage
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_evaluate_group_exact_score(db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="Group A", ext_id="g1")
    pred = await _make_prediction(db, user, match, home=2, away=1)

    count = await evaluate_match_predictions(match.id, 2, 1, None, db)
    await db.refresh(pred)

    assert count == 1
    assert pred.base_points == 10
    assert pred.points_awarded == 10
    assert pred.points_reason == PointsReason.exact_score
    assert pred.state == PredictionState.evaluated


@pytest.mark.asyncio
async def test_evaluate_group_correct_outcome(db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="Group B", ext_id="g2")
    pred = await _make_prediction(db, user, match, home=1, away=0)

    await evaluate_match_predictions(match.id, 3, 1, None, db)
    await db.refresh(pred)

    assert pred.base_points == 4
    assert pred.points_awarded == 4
    assert pred.points_reason == PointsReason.correct_outcome


@pytest.mark.asyncio
async def test_evaluate_group_wrong(db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="Group C", ext_id="g3")
    pred = await _make_prediction(db, user, match, home=2, away=0)

    await evaluate_match_predictions(match.id, 0, 1, None, db)
    await db.refresh(pred)

    assert pred.base_points == 0
    assert pred.points_awarded == 0
    assert pred.points_reason == PointsReason.wrong


@pytest.mark.asyncio
async def test_evaluate_group_boost_doubles_points(db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="Group D", ext_id="g4")
    pred = await _make_prediction(db, user, match, home=2, away=1, boosted=True)

    await evaluate_match_predictions(match.id, 2, 1, None, db)
    await db.refresh(pred)

    assert pred.base_points == 10
    assert pred.points_awarded == 20


@pytest.mark.asyncio
async def test_evaluate_group_boost_zero_stays_zero(db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="Group E", ext_id="g5")
    pred = await _make_prediction(db, user, match, home=2, away=0, boosted=True)

    await evaluate_match_predictions(match.id, 0, 2, None, db)
    await db.refresh(pred)

    assert pred.base_points == 0
    assert pred.points_awarded == 0


@pytest.mark.asyncio
async def test_evaluate_group_multiple_predictions(db: AsyncSession):
    u1 = await _make_user(db, "a@t.com")
    u2 = await _make_user(db, "b@t.com")
    match = await _make_match(db, stage="Group F", ext_id="g6")

    p1 = await _make_prediction(db, u1, match, home=1, away=0)  # correct outcome
    p2 = await _make_prediction(db, u2, match, home=2, away=1)  # exact score

    count = await evaluate_match_predictions(match.id, 1, 0, None, db)
    await db.refresh(p1)
    await db.refresh(p2)

    assert count == 2
    assert p1.points_awarded == 10  # exact
    assert p2.points_awarded == 4   # correct outcome only


@pytest.mark.asyncio
async def test_evaluate_nonexistent_match_returns_zero(db: AsyncSession):
    count = await evaluate_match_predictions(99999, 1, 0, None, db)
    assert count == 0


# ---------------------------------------------------------------------------
# evaluate_match_predictions — knockout stage
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_evaluate_knockout_draw_correct_qualifier(db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="R16", ext_id="k1")
    pred = await _make_prediction(db, user, match, home=1, away=1, qualifier="Brazil")

    await evaluate_match_predictions(match.id, 1, 1, "Brazil", db)
    await db.refresh(pred)

    assert pred.points_awarded == 10
    assert pred.points_reason == PointsReason.exact_score


@pytest.mark.asyncio
async def test_evaluate_knockout_draw_wrong_qualifier(db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="QF", ext_id="k2")
    pred = await _make_prediction(db, user, match, home=0, away=0, qualifier="France")

    await evaluate_match_predictions(match.id, 0, 0, "Germany", db)
    await db.refresh(pred)

    assert pred.points_awarded == 0
    assert pred.points_reason == PointsReason.wrong


# ---------------------------------------------------------------------------
# evaluate_winner_predictions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_evaluate_winner_correct(db: AsyncSession):
    user = await _make_user(db)
    wp = WorldCupWinnerPrediction(user_id=user.id, team_name="Argentina", submitted_at=datetime.now(UTC))
    db.add(wp)
    await db.commit()
    await db.refresh(wp)

    count = await evaluate_winner_predictions("Argentina", db)
    await db.refresh(wp)

    assert count == 1
    assert wp.points_awarded == 20
    assert wp.evaluated_at is not None


@pytest.mark.asyncio
async def test_evaluate_winner_wrong(db: AsyncSession):
    user = await _make_user(db)
    wp = WorldCupWinnerPrediction(user_id=user.id, team_name="Brazil", submitted_at=datetime.now(UTC))
    db.add(wp)
    await db.commit()
    await db.refresh(wp)

    await evaluate_winner_predictions("Argentina", db)
    await db.refresh(wp)

    assert wp.points_awarded == 0


@pytest.mark.asyncio
async def test_evaluate_winner_case_insensitive(db: AsyncSession):
    user = await _make_user(db)
    wp = WorldCupWinnerPrediction(user_id=user.id, team_name="argentina", submitted_at=datetime.now(UTC))
    db.add(wp)
    await db.commit()
    await db.refresh(wp)

    await evaluate_winner_predictions("Argentina", db)
    await db.refresh(wp)

    assert wp.points_awarded == 20


@pytest.mark.asyncio
async def test_evaluate_winner_skips_already_evaluated(db: AsyncSession):
    user = await _make_user(db)
    wp = WorldCupWinnerPrediction(
        user_id=user.id,
        team_name="Argentina",
        submitted_at=datetime.now(UTC),
        points_awarded=20,
        evaluated_at=datetime.now(UTC),
    )
    db.add(wp)
    await db.commit()
    await db.refresh(wp)

    count = await evaluate_winner_predictions("Argentina", db)
    assert count == 0  # already evaluated, skipped
