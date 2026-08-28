import json
import logging
import sys
import time
from contextvars import ContextVar

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

logger = logging.getLogger("ai_service")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


def configure_logging(level: str = "info") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.handlers = [handler]
    logger.setLevel(level.upper())
    logger.propagate = False


def log_event(operation: str, **fields) -> None:
    """Emit one structured JSON log line, always tagged with the current
    request's correlation id (see app.main's request-id middleware)."""
    payload = {
        "timestamp": time.time(),
        "requestId": request_id_ctx.get(),
        "operation": operation,
        **fields,
    }
    logger.info(json.dumps(payload, default=str))
