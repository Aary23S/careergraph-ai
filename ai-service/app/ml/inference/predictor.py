"""Phase 4H section 12 -- the stable prediction contract for the trained
opportunity-ranking model.

    input: feature values (by name, same names as FEATURE_COLUMNS) + an
           optional explicit model version
    output: {score, modelVersion, featureVersion, modelName, isDevelopmentOnly}

Pure inference: this module never fits or mutates a model, only loads an
already-serialized artifact and scores it.
"""
import json
import os

from app.ml.training import model
from app.ml.training.constants import FEATURE_COLUMNS, MODEL_NAME
from app.ml.training.features import to_frame


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


class OpportunityRankerPredictor:
    def __init__(self, models_dir="models", model_name=MODEL_NAME, model_version=None):
        resolved_version = model_version or latest_model_version(models_dir, model_name)
        if resolved_version is None:
            raise PredictorNotReadyError(
                f"No trained model found under {models_dir}/{model_name}. Run "
                "`python -m app.ml.training.train_opportunity_ranker --mode development` "
                "to produce one, or --mode real once enough labeled data exists "
                "(see docs/opportunity-ranking.md)."
            )

        version_dir = os.path.join(models_dir, model_name, resolved_version)
        model_path = os.path.join(version_dir, "model.joblib")
        metadata_path = os.path.join(version_dir, "model-metadata.json")
        if not os.path.exists(model_path):
            raise PredictorNotReadyError(f"Model artifact missing: {model_path}")

        self.model_version = resolved_version
        self.model_name = model_name
        self._pipeline = model.load_model(model_path)

        self.metadata = {}
        if os.path.exists(metadata_path):
            with open(metadata_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
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

        row = {col: normalized_features.get(col) for col in FEATURE_COLUMNS}
        X = to_frame([row])
        score = float(model.predict_scores(self._pipeline, X)[0])
        return {
            "score": round(score, 4),
            "modelVersion": self.model_version,
            "featureVersion": self.feature_version,
            "modelName": self.model_name,
            "isDevelopmentOnly": self.is_development_only,
        }

