import json
import os
import shutil
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.ml.inference.predictor import (
    OpportunityRankerPredictor,
    latest_model_version,
    get_cached_predictor,
    _loaded_predictors,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_serving_test_dir(tmp_path):
    original_models_dir = settings.opportunity_ranker_models_dir
    original_fake_models = settings.use_fake_models
    
    settings.opportunity_ranker_models_dir = str(tmp_path)
    settings.use_fake_models = False
    
    _loaded_predictors.clear()
    
    yield
    
    settings.opportunity_ranker_models_dir = original_models_dir
    settings.use_fake_models = original_fake_models
    _loaded_predictors.clear()


def create_dummy_model(version: str, is_development_only: bool = False, checksum: str = "valid-hash"):
    v_dir = os.path.join(settings.opportunity_ranker_models_dir, "career-opportunity-ranker", version)
    os.makedirs(v_dir, exist_ok=True)
    
    model_file = os.path.join(v_dir, "model.joblib")
    with open(model_file, "wb") as f:
        f.write(b"dummy binary data")
        
    import hashlib
    h = hashlib.sha256()
    h.update(b"dummy binary data")
    actual_hash = h.hexdigest()

    from app.features.registry import get_feature_set
    fset = get_feature_set("opportunity-ranking", "v1")
    
    meta = {
        "featureSet": "opportunity-ranking",
        "featureVersion": "v1",
        "featureSchemaChecksum": fset.schema_checksum,
        "isDevelopmentOnly": is_development_only,
        "checksum": actual_hash if checksum == "valid-hash" else checksum,
    }
    
    with open(os.path.join(v_dir, "model-metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f)
        
    return actual_hash


def test_predict_endpoint_missing_model():
    response = client.post(
        "/v1/models/opportunity-ranker/predict",
        json={"features": {"skill_overlap": 0.5}},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "MODEL_NOT_READY"


def test_predict_endpoint_development_only_model(monkeypatch):
    create_dummy_model("v20260829T000000Z", is_development_only=True)
    monkeypatch.setattr("app.ml.training.model.load_model", lambda path: "fake-pipeline")
    
    response = client.post(
        "/v1/models/opportunity-ranker/predict",
        json={"features": {"skill_overlap": 0.5}},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "MODEL_NOT_PRODUCTION_READY"


def test_predict_endpoint_checksum_mismatch(monkeypatch):
    create_dummy_model("v20260829T000000Z", is_development_only=False, checksum="invalid-checksum-string")
    monkeypatch.setattr("app.ml.training.model.load_model", lambda path: "fake-pipeline")
    
    response = client.post(
        "/v1/models/opportunity-ranker/predict",
        json={"features": {"skill_overlap": 0.5}},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "FEATURE_VERSION_MISMATCH"
    assert "checksum invalid" in response.json()["reason"]


def test_predict_endpoint_payload_size_limit():
    large_payload = json.dumps({
        "features": {"skill_overlap": 0.5},
        "junk": "A" * (settings.opportunity_ranker_max_request_size_bytes + 100)
    })
    response = client.post(
        "/v1/models/opportunity-ranker/predict",
        headers={"content-length": str(len(large_payload))},
        content=large_payload,
    )
    assert response.status_code == 413


def test_predict_endpoint_batch_limit():
    instances = [{"skill_overlap": 0.5}] * (settings.opportunity_ranker_max_batch_size + 1)
    response = client.post(
        "/v1/models/opportunity-ranker/predict",
        json={"instances": instances},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "BATCH_LIMIT_EXCEEDED"


def test_readiness_endpoint_not_ready():
    response = client.get("/readiness")
    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"


def test_readiness_endpoint_ready(monkeypatch):
    create_dummy_model("v20260829T000000Z", is_development_only=False)
    monkeypatch.setattr("app.ml.training.model.load_model", lambda path: "fake-pipeline")
    monkeypatch.setattr("app.ml.inference.predictor.resolve_active_production_model", lambda: {
        "version": "v20260829T000000Z",
        "status": "production",
        "model_registry_id": "some-uuid",
    })
    
    response = client.get("/readiness")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["modelVersion"] == "v20260829T000000Z"
