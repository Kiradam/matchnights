import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.seed import seed_admin
from app.db.session import async_session_maker
from app.routers import health
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.admin.users import router as admin_users_router

setup_logging()
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("wc2026-planner starting up")
    async with async_session_maker() as db:
        await seed_admin(db)
    yield
    logger.info("wc2026-planner shutting down")


app = FastAPI(title="wc2026-planner", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(admin_users_router)
