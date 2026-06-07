"""add prediction tables

Revision ID: 4aad1e5b93dd
Revises: 0007
Create Date: 2026-06-07 09:38:44.976649
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "4aad1e5b93dd"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "match_predictions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("home_goals", sa.Integer(), nullable=False),
        sa.Column("away_goals", sa.Integer(), nullable=False),
        sa.Column(
            "predicted_outcome",
            sa.Enum("home_win", "away_win", "draw", name="predictedoutcome"),
            nullable=False,
        ),
        sa.Column("predicted_qualifier", sa.String(length=100), nullable=True),
        sa.Column("boosted", sa.Boolean(), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("points_awarded", sa.Integer(), nullable=True),
        sa.Column("base_points", sa.Integer(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "points_reason",
            sa.Enum("exact_score", "correct_outcome", "wrong", name="pointsreason"),
            nullable=True,
        ),
        sa.Column(
            "state",
            sa.Enum(
                "tip_available",
                "tip_locked",
                "evaluated",
                "manual_review",
                name="predictionstate",
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "match_id", name="uq_prediction_user_match"),
    )
    with op.batch_alter_table("match_predictions", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_match_predictions_match_id"), ["match_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_match_predictions_user_id"), ["user_id"], unique=False
        )

    op.create_table(
        "world_cup_winner_predictions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("team_name", sa.String(length=100), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("points_awarded", sa.Integer(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_winner_prediction_user"),
    )
    with op.batch_alter_table("world_cup_winner_predictions", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_world_cup_winner_predictions_user_id"), ["user_id"], unique=True
        )


def downgrade() -> None:
    with op.batch_alter_table("world_cup_winner_predictions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_world_cup_winner_predictions_user_id"))
    op.drop_table("world_cup_winner_predictions")

    with op.batch_alter_table("match_predictions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_match_predictions_user_id"))
        batch_op.drop_index(batch_op.f("ix_match_predictions_match_id"))
    op.drop_table("match_predictions")
