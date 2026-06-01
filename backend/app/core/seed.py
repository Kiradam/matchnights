"""Bootstrap first admin user on first startup (issue #108)."""
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


async def seed_admin(db: AsyncSession) -> None:
    if not settings.FIRST_ADMIN_EMAIL or not settings.FIRST_ADMIN_PASSWORD:
        logger.warning("FIRST_ADMIN_EMAIL/PASSWORD not set; skipping admin seed")
        return

    result = await db.execute(select(User).where(User.role == UserRole.admin))
    if result.scalar_one_or_none():
        return  # admin already exists

    admin = User(
        email=settings.FIRST_ADMIN_EMAIL,
        full_name="Admin",
        hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD),
        role=UserRole.admin,
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    logger.info("First admin created: %s", settings.FIRST_ADMIN_EMAIL)
