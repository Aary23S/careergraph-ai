from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import settings
from app.schemas.health import HealthResponse
from app.ml.inference.predictor import get_cached_predictor

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """No secrets, no model-loading -- must respond even if no model has
    ever been loaded (models are lazy, see app.models.registry)."""
    return HealthResponse(status="ok", service=settings.service_name, version=settings.service_version)


@router.get("/readiness")
def readiness():
    """Checks if the active production model is present, loaded, and valid.
    Returns 503 Service Unavailable if absent or invalid."""
    try:
        if settings.use_fake_models:
            return {"status": "ready", "modelVersion": "fake-version"}

        predictor = get_cached_predictor(settings.opportunity_ranker_models_dir)
        predictor.verify_production_readiness()
        return {
            "status": "ready",
            "modelVersion": predictor.model_version,
            "featureSet": predictor.feature_set_name,
            "featureVersion": predictor.feature_version,
        }
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "reason": str(exc)
            }
        )
