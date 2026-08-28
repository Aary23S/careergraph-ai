from fastapi import APIRouter

from app.config import settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """No secrets, no model-loading -- must respond even if no model has
    ever been loaded (models are lazy, see app.models.registry)."""
    return HealthResponse(status="ok", service=settings.service_name, version=settings.service_version)
