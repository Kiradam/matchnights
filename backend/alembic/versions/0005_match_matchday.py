"""Add matchday to matches.

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-02
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("matchday", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "matchday")
