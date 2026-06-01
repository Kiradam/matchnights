"""Group-visibility logic for preferences (M6 #49 — must run before #40)."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import UserGroup
from app.models.user import User, UserRole


async def get_visible_users_for_match(
    db: AsyncSession,
    match_id: int,
    requesting_user: User,
) -> list[User]:
    """
    Return the set of users whose preferences the requesting_user may see
    for a given match.

    Rules:
    - Admins see all users.
    - Regular users see themselves plus any user who shares at least one group.
    """
    if requesting_user.role == UserRole.admin:
        result = await db.execute(select(User))
        return list(result.scalars())

    # Find group IDs the requesting user belongs to
    my_groups_result = await db.execute(
        select(UserGroup.group_id).where(UserGroup.user_id == requesting_user.id)
    )
    my_group_ids = [r for (r,) in my_groups_result]

    if not my_group_ids:
        # Not in any group — only see yourself
        return [requesting_user]

    # Find all user IDs in those groups (including self)
    peers_result = await db.execute(
        select(UserGroup.user_id)
        .where(UserGroup.group_id.in_(my_group_ids))
        .distinct()
    )
    peer_ids = list({r for (r,) in peers_result})

    users_result = await db.execute(select(User).where(User.id.in_(peer_ids)))
    return list(users_result.scalars())
