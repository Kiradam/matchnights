"""Add home_team_tla and away_team_tla to matches.

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-03
"""

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("home_team_tla", sa.String(10), nullable=True))
    op.add_column("matches", sa.Column("away_team_tla", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "away_team_tla")
    op.drop_column("matches", "home_team_tla")
