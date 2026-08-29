"""Phase 4H section 13/15 -- internal/development-only shadow inference for
the career-opportunity-ranking model.

This router is only mounted at all when `OPPORTUNITY_RANKER_SHADOW_ENABLED`
is true (see app/main.py) -- when the flag is off (the default), this path
does not exist (404 from FastAPI's own router dispatch), not merely
"disabled" in a 200 response body. That is a deliberately stronger gate than
Phase 4F's tracking endpoints (which stay mounted and self-report
"skipped"): a tracking call can never influence a ranking decision, but a
scoring endpoint could be, so it is not exposed at all unless explicitly
turned on for development/staging use.

Nothing in server/ (the Node backend, the Job Tracker UI, or the
deterministic ruleScore/finalScore job-match pipeline) calls this endpoint.
The existing deterministic ranking remains the product's sole authoritative
ranking signal -- see docs/opportunity-ranking.md.
"""
from fastapi import APIRouter

from app.config import settings
from app.ml.inference.predictor import (
    FeatureVersionMismatchError,
    OpportunityRankerPredictor,
    PredictorNotReadyError,
)
from app.schemas.opportunity_ranking import OpportunityScoreRequest, OpportunityScoreResponse

router = APIRouter(prefix="/v1/ml/opportunity-ranking", tags=["opportunity-ranking-shadow"])


@router.post("/shadow-score", response_model=OpportunityScoreResponse)
async def shadow_score(payload: OpportunityScoreRequest) -> OpportunityScoreResponse:
    try:
        predictor = OpportunityRankerPredictor(
            models_dir=settings.opportunity_ranker_models_dir,
            model_version=payload.modelVersion,
        )
        prediction = predictor.predict(payload.features)
        return OpportunityScoreResponse(status="scored", **prediction)
    except PredictorNotReadyError as exc:
        return OpportunityScoreResponse(status="MODEL_NOT_READY", reason=str(exc))
    except FeatureVersionMismatchError as exc:
        return OpportunityScoreResponse(status="FEATURE_VERSION_MISMATCH", reason=str(exc))

