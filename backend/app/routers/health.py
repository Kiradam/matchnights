import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health", tags=["health"])
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:
        logger.error("Health check DB query failed: %s", exc)
        db_status = "error"

    overall = "ok" if db_status == "ok" else "degraded"
    return {"status": overall, "db": db_status, "version": "0.1.0"}
