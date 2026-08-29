import json
import os
import threading
from typing import Any, Dict, Optional

from app.config import settings
from app.ml.training import model
from app.ml.training.constants import FEATURE_COLUMNS, MODEL_NAME


class PredictorNotReadyError(RuntimeError):
    pass


class FeatureVersionMismatchError(RuntimeError):
    pass


def latest_model_version(models_dir="models", model_name=MODEL_NAME):
    model_root = os.path.join(models_dir, model_name)
    if not os.path.isdir(model_root):
        return None
    versions = sorted(
        entry
        for entry in os.listdir(model_root)
        if os.path.isfile(os.path.join(model_root, entry, "model.joblib"))
    )
    return versions[-1] if versions else None


def resolve_active_production_model() -> Optional[dict]:
    """Queries DB to resolve the production model assignment for 'ranking' type."""
    from app.pipelines.db import fetch_all
    query = """
        SELECT ma.model_registry_id, mr.name, mr.version, mr.status, mr.artifact_uri, mr.metadata
        FROM model_assignments ma
        JOIN model_registry mr ON mr.id = ma.model_registry_id
        WHERE ma.model_type = 'ranking' AND ma.environment = 'production'
        ORDER BY ma.assigned_at DESC
        LIMIT 1
    """
    try:
        rows = fetch_all(query)
        if rows:
            return rows[0]
    except Exception as exc:
        from app.logging_config import log_event
        log_event("db_resolution_warning", error=str(exc))
    return None


def resolve_model_metadata_and_version(model_version: Optional[str] = None, models_dir: str = "models") -> dict:
    db_model = None
    if not model_version and settings.database_url:
        db_model = resolve_active_production_model()
        if db_model:
            model_version = db_model["version"]

    resolved_version = model_version or latest_model_version(models_dir)
    if resolved_version is None:
        raise PredictorNotReadyError(
            f"No trained model found under {models_dir}/{MODEL_NAME}."
        )

    version_dir = os.path.join(models_dir, MODEL_NAME, resolved_version)
    metadata_path = os.path.join(version_dir, "model-metadata.json")
    metadata = {}
    if os.path.exists(metadata_path):
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

    return {
        "modelVersion": resolved_version,
        "metadata": metadata,
        "db_model": db_model,
    }


class OpportunityRankerPredictor:
    def __init__(self, models_dir="models", model_name=MODEL_NAME, model_version=None, resolved_meta=None):
        if resolved_meta is None:
            resolved_meta = resolve_model_metadata_and_version(model_version, models_dir)

        resolved_version = resolved_meta["modelVersion"]
        self.model_version = resolved_version
        self.model_name = model_name
        self.metadata = resolved_meta["metadata"]
        self.db_model = resolved_meta["db_model"]

        version_dir = os.path.join(models_dir, model_name, resolved_version)
        model_path = os.path.join(version_dir, "model.joblib")
        if not os.path.exists(model_path):
            raise PredictorNotReadyError(f"Model artifact missing: {model_path}")

        # Loading model safely with observability
        from app.logging_config import log_event
        log_event("model_loading_start", version=resolved_version)
        self._pipeline = model.load_model(model_path)
        log_event("model_loading_complete", version=resolved_version)

        self.feature_set_name = self.metadata.get("featureSet", "opportunity-ranking")
        self.feature_version = self.metadata.get("featureVersion", "v1")
        self.feature_schema_checksum = self.metadata.get("featureSchemaChecksum")
        self.is_development_only = bool(self.metadata.get("isDevelopmentOnly", False))

        # Enforce Feature Version Compatibility
        from app.features.registry import get_feature_set
        fset = get_feature_set(self.feature_set_name, self.feature_version)
        if not fset:
            raise FeatureVersionMismatchError(
                f"Required Feature Set '{self.feature_set_name}:{self.feature_version}' not found in registry."
            )
        if self.feature_schema_checksum and fset.schema_checksum != self.feature_schema_checksum:
            raise FeatureVersionMismatchError(
                f"Model feature schema checksum mismatch: expected '{self.feature_schema_checksum}', "
                f"but registry has '{fset.schema_checksum}'."
            )

        # Verify artifact checksum to prevent model tampering or corruption
        computed_checksum = model.compute_artifact_checksum(model_path)
        expected_checksum = self.metadata.get("checksum")
        if expected_checksum and computed_checksum != expected_checksum:
            raise FeatureVersionMismatchError(
                f"Model artifact checksum invalid: expected {expected_checksum}, got {computed_checksum}."
            )

    def verify_production_readiness(self):
        """Verifies if the loaded model registry status is production-ready."""
        if self.is_development_only:
            raise FeatureVersionMismatchError("MODEL_NOT_PRODUCTION_READY")

        # If DB assignment model loaded, check status
        if self.db_model and self.db_model.get("status") != "production":
            raise FeatureVersionMismatchError(
                f"Model resolved status is '{self.db_model.get('status')}', expected 'production'."
            )

    def predict(self, feature_values: dict) -> dict:
        """`feature_values` may be partial -- any FEATURE_COLUMNS key not
        present is treated as missing (None), exactly like a published
        dataset row with a null feature (the same imputation the model was
        trained with then applies)."""
        # Preprocess features using FeatureBuilder.normalize_features
        from app.features.builder import FeatureBuilder
        builder = FeatureBuilder(self.feature_set_name, self.feature_version)
        normalized_features = builder.normalize_features(feature_values)

        # Validate input feature values against FeatureSet constraints
        from app.features.validate import validate_feature_values
        is_valid, errors = validate_feature_values(normalized_features, self.feature_set_name, self.feature_version)
        if not is_valid:
            raise FeatureVersionMismatchError(
                f"Input features failed validation constraints: {', '.join(errors)}"
            )

        from app.ml.training.features import to_frame
        row = {col: normalized_features.get(col) for col in FEATURE_COLUMNS}
        X = to_frame([row])
        score = float(model.predict_scores(self._pipeline, X)[0])
        return {
            "score": round(score, 4),
            "modelVersion": self.model_version,
            "featureVersion": self.feature_version,
            "featureSet": self.feature_set_name,
            "modelName": self.model_name,
            "isDevelopmentOnly": self.is_development_only,
        }


# Thread-safe Cache Implementation
_loaded_predictors = {}
_predictors_lock = threading.Lock()


def get_cached_predictor(models_dir: str = "models", model_version: Optional[str] = None) -> OpportunityRankerPredictor:
    # Resolve the target model details first (outside cache lock to allow concurrent hits)
    resolved_meta = resolve_model_metadata_and_version(model_version, models_dir)
    resolved_version = resolved_meta["modelVersion"]

    with _predictors_lock:
        cache_key = (MODEL_NAME, resolved_version)
        if cache_key not in _loaded_predictors:
            _loaded_predictors[cache_key] = OpportunityRankerPredictor(
                models_dir=models_dir,
                model_name=MODEL_NAME,
                model_version=resolved_version,
                resolved_meta=resolved_meta
            )
        return _loaded_predictors[cache_key]


def preload_models(models_dir: str = "models"):
    """Preloads the latest or active production opportunity ranking model."""
    from app.logging_config import log_event
    log_event("model_preloading_start", models_dir=models_dir)
    try:
        predictor = get_cached_predictor(models_dir=models_dir)
        log_event("model_preloading_complete", version=predictor.model_version)
    except Exception as exc:
        log_event("model_preloading_failed", error=str(exc))
