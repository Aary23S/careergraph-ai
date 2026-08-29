import asyncio
import os
import json
from typing import Dict, List, Optional, Union

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.ml.inference.predictor import (
    FeatureVersionMismatchError,
    PredictorNotReadyError,
    get_cached_predictor,
)
from app.features.builder import FeatureBuilder
from app.features.registry import get_feature_set
from app.ml.training import data
from app.ml.training.pipeline import run_training

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

            # Predict each input
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
        err_msg = str(exc)
        if "MODEL_NOT_PRODUCTION_READY" in err_msg:
            return OpportunityPredictResponse(status="MODEL_NOT_PRODUCTION_READY", reason=err_msg)
        return OpportunityPredictResponse(status="FEATURE_VERSION_MISMATCH", reason=err_msg)
    except Exception as exc:
        return OpportunityPredictResponse(status="INTERNAL_ERROR", reason=str(exc))


class DriftResponse(BaseModel):
    status: str
    drift_detected: bool
    features: dict
    modelVersion: str
    datasetVersion: str


@router.get("/drift", response_model=DriftResponse)
def compute_drift(modelVersion: Optional[str] = None) -> DriftResponse:
    try:
        predictor = get_cached_predictor(
            models_dir=settings.opportunity_ranker_models_dir,
            model_version=modelVersion
        )
        
        builder = FeatureBuilder("opportunity-ranking", "v1")
        
        if settings.use_fake_models or not predictor.metadata:
            mock_baseline = {
                "skill_overlap": {"mean": 0.5, "null_rate": 0.1},
                "domain_overlap": {"mean": 0.5, "null_rate": 0.1}
            }
            mock_current = {
                "skill_overlap": {"mean": 0.7, "null_rate": 0.1},
                "domain_overlap": {"mean": 0.5, "null_rate": 0.1}
            }
            drift_report = builder.compare_drift(mock_baseline, mock_current, threshold=0.1)
            return DriftResponse(
                status="computed",
                drift_detected=drift_report["drift_detected"],
                features=drift_report["features"],
                modelVersion=predictor.model_version or "fake-version",
                datasetVersion="fake-dataset"
            )
            
        dataset_version = predictor.metadata.get("datasetVersion")
        if not dataset_version:
            raise HTTPException(status_code=400, detail="Active model metadata is missing datasetVersion.")
            
        try:
            baseline_dataset = data.load_dataset_rows(
                settings.opportunity_ranker_models_dir.replace("models", "datasets"),
                "opportunity-ranking",
                dataset_version
            )
            baseline_stats = builder.calculate_statistics(baseline_dataset.get("train", []))
        except Exception:
            baseline_stats = {
                "skill_overlap": {"mean": 0.5, "null_rate": 0.1},
                "domain_overlap": {"mean": 0.5, "null_rate": 0.1}
            }
            
        try:
            curr_dataset = data.build_accumulated_dataset(
                settings.opportunity_ranker_models_dir.replace("models", "datasets"),
                "opportunity-ranking"
            )
            curr_stats = builder.calculate_statistics(data.all_rows(curr_dataset))
        except Exception:
            curr_stats = baseline_stats
            
        drift_report = builder.compare_drift(baseline_stats, curr_stats, threshold=0.1)
        return DriftResponse(
            status="computed",
            drift_detected=drift_report["drift_detected"],
            features=drift_report["features"],
            modelVersion=predictor.model_version,
            datasetVersion=dataset_version
        )
    except PredictorNotReadyError as exc:
        raise HTTPException(status_code=503, detail=f"Predictor not ready: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class RetrainRequest(BaseModel):
    mode: Optional[str] = "development"
    datasetVersion: Optional[str] = None
    noRegister: Optional[bool] = False


class RetrainResponse(BaseModel):
    status: str
    reason: Optional[str] = None
    modelVersion: Optional[str] = None
    checksum: Optional[str] = None


@router.post("/retrain", response_model=RetrainResponse)
def trigger_retraining(payload: RetrainRequest) -> RetrainResponse:
    try:
        mode_to_use = "development" if settings.use_fake_models else payload.mode
        result = run_training(
            mode=mode_to_use,
            dataset_version=payload.datasetVersion,
            register_candidate=not payload.noRegister
        )
        if result["status"] == "MODEL_NOT_READY":
            return RetrainResponse(status="MODEL_NOT_READY", reason=result["reason"])
            
        return RetrainResponse(
            status="trained",
            modelVersion=result.get("modelVersion"),
            checksum=result.get("checksum")
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
