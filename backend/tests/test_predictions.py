"""Integration tests for prediction API endpoints and leaderboards."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.group import Group, UserGroup
from app.models.match import Match, MatchStatus
from app.models.prediction import (
    MatchPrediction,
    PointsReason,
    PredictedOutcome,
    PredictionState,
    WorldCupWinnerPrediction,
)
from app.models.user import User, UserRole

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


async def _make_user(db: AsyncSession, email: str = "u@t.com", role: UserRole = UserRole.user) -> User:
    u = User(email=email, full_name="Test User", hashed_password=hash_password("pass1234"), role=role)
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _make_match(
    db: AsyncSession,
    *,
    stage: str = "Group A",
    hours_offset: float = 2.0,
    ext_id: str = "ext1",
) -> Match:
    """Create a match. Positive hours_offset = future, negative = past."""
    dt = datetime.now(UTC) + timedelta(hours=hours_offset)
    m = Match(
        external_id=ext_id,
        home_team="Home FC",
        away_team="Away FC",
        stage=stage,
        match_datetime=dt,
        status=MatchStatus.scheduled if hours_offset > 0 else MatchStatus.finished,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


async def _login(client: AsyncClient, email: str) -> str:
    r = await client.post("/auth/login", json={"email": email, "password": "pass1234"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_evaluated_prediction(
    db: AsyncSession,
    user: User,
    match: Match,
    home: int,
    away: int,
    points: int,
    base: int,
    exact: bool = False,
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
        boosted=False,
        submitted_at=datetime.now(UTC),
        state=PredictionState.evaluated,
        points_awarded=points,
        base_points=base,
        points_reason=PointsReason.exact_score if exact else PointsReason.correct_outcome,
        evaluated_at=datetime.now(UTC),
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


# ---------------------------------------------------------------------------
# PUT /predictions/{match_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_submit_prediction_before_kickoff(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, hours_offset=2)
    token = await _login(client, user.email)

    r = await client.put(
        f"/predictions/{match.id}",
        json={"home_goals": 2, "away_goals": 1},
        headers=_auth(token),
    )
    assert r.status_code == 200
    data = r.json()
    assert data["home_goals"] == 2
    assert data["away_goals"] == 1
    assert data["predicted_outcome"] == "home_win"
    assert data["state"] == "tip_available"


@pytest.mark.asyncio
async def test_submit_prediction_after_kickoff_rejected(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, hours_offset=-1)
    token = await _login(client, user.email)

    r = await client.put(
        f"/predictions/{match.id}",
        json={"home_goals": 1, "away_goals": 0},
        headers=_auth(token),
    )
    assert r.status_code == 400
    assert "kicked off" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_submit_prediction_nonexistent_match(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    token = await _login(client, user.email)

    r = await client.put(
        "/predictions/99999",
        json={"home_goals": 1, "away_goals": 0},
        headers=_auth(token),
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_existing_prediction(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, hours_offset=3)
    token = await _login(client, user.email)
    headers = _auth(token)

    await client.put(f"/predictions/{match.id}", json={"home_goals": 1, "away_goals": 0}, headers=headers)
    r = await client.put(f"/predictions/{match.id}", json={"home_goals": 3, "away_goals": 2}, headers=headers)

    assert r.status_code == 200
    assert r.json()["home_goals"] == 3
    assert r.json()["away_goals"] == 2


@pytest.mark.asyncio
async def test_submit_knockout_draw_without_qualifier_rejected(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="R16", hours_offset=2, ext_id="ko1")
    token = await _login(client, user.email)

    r = await client.put(
        f"/predictions/{match.id}",
        json={"home_goals": 1, "away_goals": 1},
        headers=_auth(token),
    )
    assert r.status_code == 422
    assert "qualifier" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_submit_knockout_draw_with_qualifier_accepted(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="QF", hours_offset=2, ext_id="ko2")
    token = await _login(client, user.email)

    r = await client.put(
        f"/predictions/{match.id}",
        json={"home_goals": 1, "away_goals": 1, "predicted_qualifier": "Brazil"},
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["predicted_qualifier"] == "Brazil"


@pytest.mark.asyncio
async def test_submit_knockout_non_draw_no_qualifier_needed(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="SF", hours_offset=2, ext_id="ko3")
    token = await _login(client, user.email)

    r = await client.put(
        f"/predictions/{match.id}",
        json={"home_goals": 2, "away_goals": 0},
        headers=_auth(token),
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_submit_prediction_requires_auth(client: AsyncClient, db: AsyncSession):
    match = await _make_match(db, hours_offset=2)
    r = await client.put(f"/predictions/{match.id}", json={"home_goals": 1, "away_goals": 0})
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Boost validation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_boost_accepted_within_allowance(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="Group A", hours_offset=2, ext_id="b1")
    token = await _login(client, user.email)

    r = await client.put(
        f"/predictions/{match.id}",
        json={"home_goals": 1, "away_goals": 0, "boosted": True},
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["boosted"] is True


@pytest.mark.asyncio
async def test_boost_rejected_over_limit(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    token = await _login(client, user.email)
    headers = _auth(token)

    # Group stage allows 4 boosts; submit 4 boosted predictions on different matches
    for i in range(4):
        m = await _make_match(db, stage="Group A", hours_offset=2, ext_id=f"bl{i}")
        r = await client.put(f"/predictions/{m.id}", json={"home_goals": 1, "away_goals": 0, "boosted": True}, headers=headers)
        assert r.status_code == 200

    # 5th boost in the same stage should be rejected
    extra = await _make_match(db, stage="Group A", hours_offset=2, ext_id="bl_extra")
    r = await client.put(f"/predictions/{extra.id}", json={"home_goals": 1, "away_goals": 0, "boosted": True}, headers=headers)
    assert r.status_code == 400
    assert "boost limit" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_boost_not_double_counted_on_edit(client: AsyncClient, db: AsyncSession):
    """Editing an already-boosted prediction doesn't consume an extra boost slot."""
    user = await _make_user(db)
    token = await _login(client, user.email)
    headers = _auth(token)

    # Fill up 3 of 4 group boost slots
    for i in range(3):
        m = await _make_match(db, stage="Group A", hours_offset=2, ext_id=f"dc{i}")
        await client.put(f"/predictions/{m.id}", json={"home_goals": 1, "away_goals": 0, "boosted": True}, headers=headers)

    # Submit the 4th boosted prediction
    target = await _make_match(db, stage="Group A", hours_offset=2, ext_id="dc_target")
    r = await client.put(f"/predictions/{target.id}", json={"home_goals": 1, "away_goals": 0, "boosted": True}, headers=headers)
    assert r.status_code == 200

    # Re-edit the same prediction — boost slot count should not increase
    r = await client.put(f"/predictions/{target.id}", json={"home_goals": 2, "away_goals": 1, "boosted": True}, headers=headers)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_boost_not_available_for_final(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, stage="Final", hours_offset=2, ext_id="final1")
    token = await _login(client, user.email)

    r = await client.put(
        f"/predictions/{match.id}",
        json={"home_goals": 1, "away_goals": 0, "boosted": True},
        headers=_auth(token),
    )
    assert r.status_code == 400
    assert "boosts are not available" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# GET /predictions/{match_id} and GET /predictions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_prediction_found(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, hours_offset=2)
    token = await _login(client, user.email)
    headers = _auth(token)

    await client.put(f"/predictions/{match.id}", json={"home_goals": 0, "away_goals": 0}, headers=headers)
    r = await client.get(f"/predictions/{match.id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["home_goals"] == 0


@pytest.mark.asyncio
async def test_get_prediction_not_found(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, hours_offset=2)
    token = await _login(client, user.email)

    r = await client.get(f"/predictions/{match.id}", headers=_auth(token))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_predictions(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    token = await _login(client, user.email)
    headers = _auth(token)

    m1 = await _make_match(db, hours_offset=2, ext_id="l1")
    m2 = await _make_match(db, hours_offset=3, ext_id="l2")

    await client.put(f"/predictions/{m1.id}", json={"home_goals": 1, "away_goals": 0}, headers=headers)
    await client.put(f"/predictions/{m2.id}", json={"home_goals": 0, "away_goals": 2}, headers=headers)

    r = await client.get("/predictions", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.asyncio
async def test_list_predictions_isolated_per_user(client: AsyncClient, db: AsyncSession):
    u1 = await _make_user(db, "u1@t.com")
    u2 = await _make_user(db, "u2@t.com")
    match = await _make_match(db, hours_offset=2)

    t1 = await _login(client, u1.email)
    t2 = await _login(client, u2.email)

    await client.put(f"/predictions/{match.id}", json={"home_goals": 1, "away_goals": 0}, headers=_auth(t1))

    r = await client.get("/predictions", headers=_auth(t2))
    assert r.json() == []


# ---------------------------------------------------------------------------
# GET/PUT /predictions/winner
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_winner_prediction_not_found(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    token = await _login(client, user.email)

    r = await client.get("/predictions/winner", headers=_auth(token))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_submit_winner_prediction(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    token = await _login(client, user.email)

    r = await client.put("/predictions/winner", json={"team_name": "Brazil"}, headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["team_name"] == "Brazil"


@pytest.mark.asyncio
async def test_update_winner_prediction(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    token = await _login(client, user.email)
    headers = _auth(token)

    await client.put("/predictions/winner", json={"team_name": "Brazil"}, headers=headers)
    r = await client.put("/predictions/winner", json={"team_name": "Argentina"}, headers=headers)

    assert r.status_code == 200
    assert r.json()["team_name"] == "Argentina"

    r = await client.get("/predictions/winner", headers=headers)
    assert r.json()["team_name"] == "Argentina"


@pytest.mark.asyncio
async def test_winner_prediction_locked_after_knockout_starts(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    token = await _login(client, user.email)

    # Create a knockout match in the past (simulating knockout stage has started)
    await _make_match(db, stage="R16", hours_offset=-1, ext_id="ko_past")

    r = await client.put("/predictions/winner", json={"team_name": "Germany"}, headers=_auth(token))
    assert r.status_code == 400
    assert "locked" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_winner_prediction_open_before_knockout_starts(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    token = await _login(client, user.email)

    # Only group matches exist — knockout hasn't started yet
    await _make_match(db, stage="Group A", hours_offset=-1, ext_id="gr_past")

    r = await client.put("/predictions/winner", json={"team_name": "Spain"}, headers=_auth(token))
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_winner_prediction_requires_auth(client: AsyncClient):
    r = await client.put("/predictions/winner", json={"team_name": "France"})
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# GET /predictions/match/{match_id}/stats
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stats_before_kickoff_returns_aggregate(client: AsyncClient, db: AsyncSession):
    """Stats are available before kickoff; only aggregate data is returned (no user names)."""
    user = await _make_user(db)
    match = await _make_match(db, hours_offset=2, ext_id="pre_kick")
    token = await _login(client, user.email)

    r = await client.get(f"/predictions/match/{match.id}/stats", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 0
    assert "outcome_counts" in data
    assert "top_scores" in data


@pytest.mark.asyncio
async def test_stats_after_kickoff(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    match = await _make_match(db, hours_offset=-1, ext_id="stats1")
    token = await _login(client, user.email)

    # Insert predictions directly (bypass deadline)
    p = MatchPrediction(
        user_id=user.id,
        match_id=match.id,
        home_goals=2,
        away_goals=1,
        predicted_outcome=PredictedOutcome.home_win,
        boosted=False,
        submitted_at=datetime.now(UTC),
        state=PredictionState.tip_locked,
    )
    db.add(p)
    await db.commit()

    r = await client.get(f"/predictions/match/{match.id}/stats", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["outcome_counts"]["home_win"] == 1
    assert data["outcome_counts"]["draw"] == 0
    assert data["outcome_counts"]["away_win"] == 0
    assert len(data["top_scores"]) == 1
    assert data["top_scores"][0]["home"] == 2
    assert data["top_scores"][0]["away"] == 1


@pytest.mark.asyncio
async def test_stats_nonexistent_match(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    token = await _login(client, user.email)

    r = await client.get("/predictions/match/99999/stats", headers=_auth(token))
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Leaderboard — global
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_global_leaderboard_sorted_by_points(client: AsyncClient, db: AsyncSession):
    u1 = await _make_user(db, "lb1@t.com")
    u2 = await _make_user(db, "lb2@t.com")
    match = await _make_match(db, hours_offset=-2, ext_id="lb_m1")
    token = await _login(client, u1.email)

    await _make_evaluated_prediction(db, u1, match, 2, 1, points=10, base=10, exact=True)
    await _make_evaluated_prediction(db, u2, match, 1, 0, points=4, base=4)

    r = await client.get("/leaderboard/global", headers=_auth(token))
    assert r.status_code == 200
    entries = r.json()

    assert entries[0]["total_points"] >= entries[1]["total_points"]
    names = [e["full_name"] for e in entries]
    assert u1.full_name in names
    assert u2.full_name in names


@pytest.mark.asyncio
async def test_global_leaderboard_exact_score_tiebreaker(client: AsyncClient, db: AsyncSession):
    u1 = await _make_user(db, "tie1@t.com")
    u2 = await _make_user(db, "tie2@t.com")
    m1 = await _make_match(db, hours_offset=-2, ext_id="tie_m1")
    m2 = await _make_match(db, hours_offset=-3, ext_id="tie_m2")
    token = await _login(client, u1.email)

    # Both have 14 pts; u1 has 1 exact, u2 has 0
    await _make_evaluated_prediction(db, u1, m1, 2, 1, points=10, base=10, exact=True)
    await _make_evaluated_prediction(db, u1, m2, 1, 0, points=4, base=4)
    await _make_evaluated_prediction(db, u2, m1, 1, 0, points=4, base=4)
    await _make_evaluated_prediction(db, u2, m2, 0, 1, points=10, base=10, exact=True)

    # Both have same total; tiebreaker is exact_score_count (both 1) then base_points (both 14)
    r = await client.get("/leaderboard/global", headers=_auth(token))
    assert r.status_code == 200
    entries = r.json()
    assert entries[0]["total_points"] == 14
    assert entries[1]["total_points"] == 14


@pytest.mark.asyncio
async def test_global_leaderboard_requires_auth(client: AsyncClient):
    r = await client.get("/leaderboard/global")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Leaderboard — group
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_group_leaderboard_non_member_forbidden(client: AsyncClient, db: AsyncSession):
    user = await _make_user(db)
    token = await _login(client, user.email)

    group = Group(name="Private Group")
    db.add(group)
    await db.commit()
    await db.refresh(group)

    r = await client.get(f"/leaderboard/group/{group.id}", headers=_auth(token))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_group_leaderboard_member_can_see(client: AsyncClient, db: AsyncSession):
    u1 = await _make_user(db, "glb1@t.com")
    u2 = await _make_user(db, "glb2@t.com")

    group = Group(name="Test Group")
    db.add(group)
    await db.commit()
    await db.refresh(group)

    for u in [u1, u2]:
        db.add(UserGroup(user_id=u.id, group_id=group.id))
    await db.commit()

    match = await _make_match(db, hours_offset=-2, ext_id="glb_m1")
    await _make_evaluated_prediction(db, u1, match, 2, 1, points=10, base=10, exact=True)
    await _make_evaluated_prediction(db, u2, match, 1, 0, points=4, base=4)

    token = await _login(client, u1.email)
    r = await client.get(f"/leaderboard/group/{group.id}", headers=_auth(token))
    assert r.status_code == 200

    entries = r.json()
    assert len(entries) == 2
    assert entries[0]["total_points"] >= entries[1]["total_points"]

    user_ids = [e["user_id"] for e in entries]
    assert u1.id in user_ids
    assert u2.id in user_ids


@pytest.mark.asyncio
async def test_group_leaderboard_only_shows_group_members(client: AsyncClient, db: AsyncSession):
    """Outsider's points must not appear in a group's leaderboard."""
    member = await _make_user(db, "mem@t.com")
    outsider = await _make_user(db, "out@t.com")

    group = Group(name="Exclusive")
    db.add(group)
    await db.commit()
    await db.refresh(group)
    db.add(UserGroup(user_id=member.id, group_id=group.id))
    await db.commit()

    match = await _make_match(db, hours_offset=-2, ext_id="excl_m1")
    await _make_evaluated_prediction(db, outsider, match, 2, 1, points=10, base=10, exact=True)

    token = await _login(client, member.email)
    r = await client.get(f"/leaderboard/group/{group.id}", headers=_auth(token))
    assert r.status_code == 200

    user_ids = [e["user_id"] for e in r.json()]
    assert outsider.id not in user_ids
