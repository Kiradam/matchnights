"""Add home_odds, draw_odds, away_odds to matches.

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-02
"""
import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("home_odds", sa.Float(), nullable=True))
    op.add_column("matches", sa.Column("draw_odds", sa.Float(), nullable=True))
    op.add_column("matches", sa.Column("away_odds", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "away_odds")
    op.drop_column("matches", "draw_odds")
    op.drop_column("matches", "home_odds")
