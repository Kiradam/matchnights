"""Add home_score and away_score to matches.

Revision ID: 5001
Revises: 4aad1e5b93dd
Create Date: 2026-06-07
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "5001"
down_revision: str | None = "4aad1e5b93dd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("home_score", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("away_score", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "away_score")
    op.drop_column("matches", "home_score")
