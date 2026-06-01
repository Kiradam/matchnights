import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.routers import health

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("wc2026-planner starting up")
    yield
    logger.info("wc2026-planner shutting down")


app = FastAPI(title="wc2026-planner", version="0.1.0", lifespan=lifespan)

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
