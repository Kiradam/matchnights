"""add sync_state table

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-01
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sync_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_result", sa.JSON(), nullable=True),
        sa.Column("request_count_today", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("request_count_date", sa.String(10), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("sync_state")
