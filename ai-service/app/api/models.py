import asyncio
from typing import Dict, List, Optional, Union

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.ml.inference.predictor import (
    FeatureVersionMismatchError,
    PredictorNotReadyError,
    get_cached_predictor,
)

router = APIRouter(prefix="/v1/models/opportunity-ranker", tags=["opportunity-ranker-serving"])

# Concurrency semaphore
_serving_semaphore = asyncio.Semaphore(settings.opportunity_ranker_concurrency_limit)


class OpportunityPredictRequest(BaseModel):
    features: Optional[dict[str, Optional[Union[str, float, int]]]] = None
    instances: Optional[list[dict[str, Optional[Union[str, float, int]]]]] = None
    modelVersion: Optional[str] = None


class PredictionItem(BaseModel):
    score: float
    modelName: str
    modelVersion: str
    featureSet: str
    featureVersion: str
    isDevelopmentOnly: bool
    modelRegistryId: Optional[str] = None


class OpportunityPredictResponse(BaseModel):
    status: str
    predictions: list[PredictionItem] = []
    reason: Optional[str] = None


@router.post("/predict", response_model=OpportunityPredictResponse)
async def predict(payload: OpportunityPredictRequest, request: Request) -> OpportunityPredictResponse:
    # 1. Payload size check
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.opportunity_ranker_max_request_size_bytes:
        raise HTTPException(status_code=413, detail="Payload Too Large")

    # 2. Extract inputs
    inputs = []
    if payload.features is not None:
        inputs.append(payload.features)
    elif payload.instances is not None:
        inputs = payload.instances

    # 3. Batch size check
    if len(inputs) > settings.opportunity_ranker_max_batch_size:
        return OpportunityPredictResponse(
            status="BATCH_LIMIT_EXCEEDED",
            reason=f"Batch size {len(inputs)} exceeds max allowed limit of {settings.opportunity_ranker_max_batch_size}."
        )
    if not inputs:
        return OpportunityPredictResponse(status="BAD_REQUEST", reason="No input features or instances provided.")

    # 4. Acquire concurrency semaphore and execute with timeout
    async def execute_predictions():
        async with _serving_semaphore:
            # Resolve & load predictor (using thread-safe cache)
            predictor = get_cached_predictor(
                models_dir=settings.opportunity_ranker_models_dir,
                model_version=payload.modelVersion
            )

            # Production check: verify model registry production status
            predictor.verify_production_readiness()

            # Predict each input (runs synchronously, so execute in thread pool or simple loop)
            # Since LogisticRegression inference is extremely fast (microseconds), running it in a loop
            # is completely fine and doesn't block the loop.
            predictions = []
            for item in inputs:
                pred = predictor.predict(item)
                predictions.append(PredictionItem(
                    score=pred["score"],
                    modelName=pred["modelName"],
                    modelVersion=pred["modelVersion"],
                    featureSet=pred["featureSet"],
                    featureVersion=pred["featureVersion"],
                    isDevelopmentOnly=pred["isDevelopmentOnly"],
                    modelRegistryId=predictor.db_model.get("model_registry_id") if predictor.db_model else None
                ))
            return predictions

    try:
        results = await asyncio.wait_for(
            execute_predictions(),
            timeout=settings.opportunity_ranker_timeout_seconds
        )
        return OpportunityPredictResponse(status="scored", predictions=results)
    except asyncio.TimeoutError:
        return OpportunityPredictResponse(
            status="TIMEOUT",
            reason=f"Prediction request timed out after {settings.opportunity_ranker_timeout_seconds}s."
        )
    except PredictorNotReadyError as exc:
        return OpportunityPredictResponse(status="MODEL_NOT_READY", reason=str(exc))
    except FeatureVersionMismatchError as exc:
        # Check if the error code is our specific development model gate
        err_msg = str(exc)
        if "MODEL_NOT_PRODUCTION_READY" in err_msg:
            return OpportunityPredictResponse(status="MODEL_NOT_PRODUCTION_READY", reason=err_msg)
        return OpportunityPredictResponse(status="FEATURE_VERSION_MISMATCH", reason=err_msg)
    except Exception as exc:
        return OpportunityPredictResponse(status="INTERNAL_ERROR", reason=str(exc))
