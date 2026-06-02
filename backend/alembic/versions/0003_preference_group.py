"""Add group_id to preferences (per-group preferences)

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-01
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing preferences are incompatible with the per-group model — clear them.
    op.execute("DELETE FROM preferences")

    with op.batch_alter_table("preferences", recreate="always") as batch_op:
        batch_op.add_column(sa.Column("group_id", sa.Integer(), nullable=False, server_default="0"))
        batch_op.drop_constraint("uq_user_match", type_="unique")
        batch_op.create_unique_constraint("uq_user_match_group", ["user_id", "match_id", "group_id"])
        batch_op.create_foreign_key("fk_pref_group_id", "groups", ["group_id"], ["id"])


def downgrade() -> None:
    op.execute("DELETE FROM preferences")

    with op.batch_alter_table("preferences", recreate="always") as batch_op:
        batch_op.drop_column("group_id")
        batch_op.drop_constraint("uq_user_match_group", type_="unique")
        batch_op.create_unique_constraint("uq_user_match", ["user_id", "match_id"])
