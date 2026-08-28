from fastapi import APIRouter

from app.config import settings
from app.schemas.tracking import RunRequest, RunResponse, TrackingStatusResponse
from app.tracking.mlflow_client import get_tracking_client, log_complete_run

router = APIRouter()


@router.post("/v1/tracking/runs", response_model=RunResponse)
def create_run(payload: RunRequest) -> RunResponse:
    """One-shot run logging (start -> log everything -> end) -- used by
    Node's ai:evaluate and benchmark scripts over HTTP. Always returns 200:
    a disabled/unreachable MLflow server is reported as
    `{"status": "skipped", ...}`, never an HTTP error, so a telemetry outage
    can never look like a failed evaluation run to the caller."""
    result = log_complete_run(
        experiment_suffix=payload.experiment,
        params=payload.params,
        metrics=payload.metrics,
        tags=payload.tags,
        artifacts=[a.model_dump() for a in payload.artifacts],
        run_name=payload.runName,
    )
    return RunResponse(**result)


@router.get("/v1/tracking/status", response_model=TrackingStatusResponse)
def tracking_status() -> TrackingStatusResponse:
    """Backs the AI Ops 'MLflow' status card. Never raises -- a failed
    connectivity check just reports connected=false."""
    if not settings.mlflow_enabled:
        return TrackingStatusResponse(enabled=False, connected=False, lastRun=None)

    client = get_tracking_client()
    connected = client.is_available()
    last_run = client.get_last_run_summary() if connected else None
    return TrackingStatusResponse(enabled=True, connected=connected, lastRun=last_run)
