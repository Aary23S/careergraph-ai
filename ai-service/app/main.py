import sys
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from app.api import embeddings, health, rerank, tracking
from app.config import settings
from app.logging_config import configure_logging, log_event, request_id_ctx

# On Windows, stdout/stderr default to the console codepage (e.g. cp1252),
# not UTF-8. MLflow's client prints emoji in its own console messages (e.g.
# "View run..." on end_run()) -- without this, that print raises
# UnicodeEncodeError, which end_run() (correctly) swallows per this
# service's failure-isolation design, but the run then never actually
# transitions out of "RUNNING". Reconfiguring here fixes the root cause
# instead of just tolerating the symptom.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log_event("startup", service=settings.service_name, version=settings.service_version)
    yield
    log_event("shutdown", service=settings.service_name)


# No CORS middleware: this is an internal-only service (see docs/python-ai-service.md
# Security section) -- browsers get no Access-Control-Allow-Origin header, so
# cross-origin calls from a frontend are rejected by default rather than opened up.
app = FastAPI(title=settings.service_name, version=settings.service_version, lifespan=lifespan)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    incoming_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    token = request_id_ctx.set(incoming_id)
    try:
        response = await call_next(request)
    finally:
        request_id_ctx.reset(token)
    response.headers["X-Request-Id"] = incoming_id
    return response


app.include_router(health.router)
app.include_router(embeddings.router)
app.include_router(rerank.router)
app.include_router(tracking.router)
