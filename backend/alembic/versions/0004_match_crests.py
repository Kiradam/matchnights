"""Add home_team_crest and away_team_crest to matches.

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-01
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("home_team_crest", sa.String(500), nullable=True))
    op.add_column("matches", sa.Column("away_team_crest", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "away_team_crest")
    op.drop_column("matches", "home_team_crest")
