import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging_config import setup_logging
from app.core.seed import seed_admin
from app.db.session import async_session_maker
from app.routers import health
from app.routers.admin.groups import router as admin_groups_router
from app.routers.admin.matches import router as admin_matches_router
from app.routers.admin.predictions import router as admin_predictions_router
from app.routers.admin.users import router as admin_users_router
from app.routers.auth import router as auth_router
from app.routers.bracket import router as bracket_router
from app.routers.groups import router as groups_router
from app.routers.matches import router as matches_router
from app.routers.predictions import router as predictions_router
from app.routers.preferences import router as preferences_router
from app.routers.standings import router as standings_router
from app.routers.users import router as users_router
from app.services.scheduler import start_scheduler, stop_scheduler

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.SECRET_KEY == "change-me-in-production":
        logger.warning("SECRET_KEY is set to the default insecure value — change it before deploying!")
    logger.info("MatchNights starting up")
    async with async_session_maker() as db:
        await seed_admin(db)
    scheduler = start_scheduler(async_session_maker)
    yield
    stop_scheduler(scheduler)
    logger.info("MatchNights shutting down")


app = FastAPI(title="MatchNights", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    logger.info(
        "request started",
        extra={"request_id": request_id, "method": request.method, "path": request.url.path},
    )
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request finished",
        extra={"request_id": request_id, "status_code": response.status_code},
    )
    return response


app.include_router(health.router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(matches_router)
app.include_router(preferences_router)
app.include_router(groups_router)
app.include_router(predictions_router)
app.include_router(standings_router)
app.include_router(bracket_router)
app.include_router(admin_users_router)
app.include_router(admin_groups_router)
app.include_router(admin_matches_router)
app.include_router(admin_predictions_router)
