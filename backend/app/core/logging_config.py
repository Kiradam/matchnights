import logging
import sys
import uuid

from pythonjsonlogger import jsonlogger

from app.core.config import settings


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = ""
        return True


def setup_logging() -> None:
    root = logging.getLogger()
    root.setLevel(settings.LOG_LEVEL)

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(request_id)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)
    root.handlers = [handler]

    # Silence noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
