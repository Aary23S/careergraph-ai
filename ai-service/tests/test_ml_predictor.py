import json
import os

import pytest

from app.ml.inference.predictor import OpportunityRankerPredictor, PredictorNotReadyError, latest_model_version
from app.ml.training import model
from app.ml.training.dev_fixtures import build_development_dataset
from app.ml.training.features import extract_labels, filter_labeled, to_frame


def _write_fake_model(models_dir, model_name="career-opportunity-ranker", version="v1", is_development_only=True):
    dataset = build_development_dataset(n=100, seed=3)
    labeled = filter_labeled(dataset["train"])
    X, y = to_frame(labeled), extract_labels(labeled)
    fitted, _ = model.train_model(X, y)

    version_dir = os.path.join(models_dir, model_name, version)
    os.makedirs(version_dir, exist_ok=True)
    model.save_model(fitted, os.path.join(version_dir, "model.joblib"))
    with open(os.path.join(version_dir, "model-metadata.json"), "w", encoding="utf-8") as f:
        json.dump({"featureVersion": "v1", "isDevelopmentOnly": is_development_only}, f)
    return version_dir


def test_latest_model_version_none_when_nothing_trained(tmp_path):
    assert latest_model_version(models_dir=str(tmp_path)) is None


def test_latest_model_version_picks_the_lexicographically_last(tmp_path):
    _write_fake_model(str(tmp_path), version="v1")
    _write_fake_model(str(tmp_path), version="v2")
    assert latest_model_version(models_dir=str(tmp_path)) == "v2"


def test_predictor_raises_when_no_model_exists(tmp_path):
    with pytest.raises(PredictorNotReadyError):
        OpportunityRankerPredictor(models_dir=str(tmp_path))


def test_predictor_loads_and_scores(tmp_path):
    _write_fake_model(str(tmp_path))
    predictor = OpportunityRankerPredictor(models_dir=str(tmp_path))
    result = predictor.predict({"skill_overlap": 0.8, "job_seniority": "senior"})
    assert 0.0 <= result["score"] <= 1.0
    assert result["modelVersion"] == "v1"
    assert result["featureVersion"] == "v1"
    assert result["isDevelopmentOnly"] is True


def test_predictor_handles_completely_empty_features(tmp_path):
    _write_fake_model(str(tmp_path))
    predictor = OpportunityRankerPredictor(models_dir=str(tmp_path))
    result = predictor.predict({})
    assert 0.0 <= result["score"] <= 1.0


def test_predictor_is_deterministic_for_the_same_input(tmp_path):
    _write_fake_model(str(tmp_path))
    predictor = OpportunityRankerPredictor(models_dir=str(tmp_path))
    features = {"skill_overlap": 0.6, "connection_relevance": 0.4, "job_role_category": "Software Engineer"}
    first = predictor.predict(features)
    second = predictor.predict(features)
    assert first["score"] == second["score"]


def test_predictor_can_target_an_explicit_version(tmp_path):
    _write_fake_model(str(tmp_path), version="v1")
    _write_fake_model(str(tmp_path), version="v2")
    predictor = OpportunityRankerPredictor(models_dir=str(tmp_path), model_version="v1")
    assert predictor.model_version == "v1"
