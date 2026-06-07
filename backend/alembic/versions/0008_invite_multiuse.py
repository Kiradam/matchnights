"""Invite tokens: replace single-use with multi-use (max 100 uses per link).

Revision ID: 0008
Revises: 5001
Create Date: 2026-06-07
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "5001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("invite_tokens") as batch_op:
        batch_op.drop_constraint("invite_tokens_used_by_id_fkey", type_="foreignkey")
        batch_op.drop_column("used_by_id")
        batch_op.add_column(
            sa.Column("use_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("max_uses", sa.Integer(), nullable=False, server_default="100")
        )


def downgrade() -> None:
    with op.batch_alter_table("invite_tokens") as batch_op:
        batch_op.drop_column("max_uses")
        batch_op.drop_column("use_count")
        batch_op.add_column(
            sa.Column("used_by_id", sa.Integer(), nullable=True)
        )
        batch_op.create_foreign_key(
            "invite_tokens_used_by_id_fkey",
            "users",
            ["used_by_id"],
            ["id"],
        )
