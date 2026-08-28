"""Phase 4H section 13/15 -- the shadow-inference endpoint. `client` (from
conftest.py) is built from the real `app.main.app`, where
OPPORTUNITY_RANKER_SHADOW_ENABLED is false by default (not set in the test
environment) -- so it must not even be routable there. The "when mounted"
behavior is tested against a standalone app that includes the router
directly, so these tests never depend on mutating global settings that
other tests might read.
"""
import os

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import opportunity_ranking
from app.config import settings
from app.ml.training import model
from app.ml.training.dev_fixtures import build_development_dataset
from app.ml.training.features import extract_labels, filter_labeled, to_frame


def test_shadow_endpoint_is_not_mounted_on_the_real_app_by_default(client):
    response = client.post("/v1/ml/opportunity-ranking/shadow-score", json={"features": {}})
    assert response.status_code == 404


def _standalone_app():
    app = FastAPI()
    app.include_router(opportunity_ranking.router)
    return app


def test_shadow_score_reports_model_not_ready_when_no_model_exists(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "opportunity_ranker_models_dir", str(tmp_path / "models"))
    client = TestClient(_standalone_app())
    response = client.post("/v1/ml/opportunity-ranking/shadow-score", json={"features": {"skill_overlap": 0.5}})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "MODEL_NOT_READY"
    assert body["score"] is None


def test_shadow_score_returns_a_score_when_a_model_exists(tmp_path, monkeypatch):
    models_dir = str(tmp_path / "models")
    dataset = build_development_dataset(n=100, seed=11)
    labeled = filter_labeled(dataset["train"])
    fitted, _ = model.train_model(to_frame(labeled), extract_labels(labeled))
    version_dir = os.path.join(models_dir, "career-opportunity-ranker", "v1")
    os.makedirs(version_dir, exist_ok=True)
    model.save_model(fitted, os.path.join(version_dir, "model.joblib"))

    monkeypatch.setattr(settings, "opportunity_ranker_models_dir", models_dir)
    client = TestClient(_standalone_app())
    response = client.post(
        "/v1/ml/opportunity-ranking/shadow-score",
        json={"features": {"skill_overlap": 0.7, "job_seniority": "senior"}},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "scored"
    assert 0.0 <= body["score"] <= 1.0
    assert body["modelVersion"] == "v1"
