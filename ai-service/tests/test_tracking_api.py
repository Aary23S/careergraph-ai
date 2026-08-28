def test_create_run_skips_when_mlflow_disabled(client):
    """MLFLOW_ENABLED defaults to false in tests -- must respond 200 with a
    'skipped' status, never an error, so a Node caller never sees this as a
    failed request."""
    response = client.post(
        "/v1/tracking/runs",
        json={"experiment": "job-enrichment", "params": {"model": "mock"}, "metrics": {"latency_ms": 10}},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "skipped"
    assert body["runId"] is None


def test_create_run_rejects_blank_experiment(client):
    response = client.post("/v1/tracking/runs", json={"experiment": "   "})
    assert response.status_code == 422


def test_create_run_rejects_missing_experiment(client):
    response = client.post("/v1/tracking/runs", json={})
    assert response.status_code == 422


def test_create_run_logged_path(client, monkeypatch):
    from app.api import tracking as tracking_route

    def fake_log_complete_run(**_kwargs):
        return {"status": "logged", "runId": "run-abc", "experiment": "careergraph-embeddings"}

    monkeypatch.setattr(tracking_route, "log_complete_run", fake_log_complete_run)

    response = client.post("/v1/tracking/runs", json={"experiment": "embeddings", "metrics": {"avg_latency_ms": 50}})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "logged"
    assert body["runId"] == "run-abc"
    assert body["experiment"] == "careergraph-embeddings"


def test_status_reports_disabled_by_default(client):
    response = client.get("/v1/tracking/status")
    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is False
    assert body["connected"] is False
    assert body["lastRun"] is None


def test_status_reports_enabled_but_unreachable(client, monkeypatch):
    from app.api import tracking as tracking_route
    from app.config import settings

    monkeypatch.setattr(settings, "mlflow_enabled", True)

    class FakeClient:
        def is_available(self):
            return False

        def get_last_run_summary(self):
            return None

    monkeypatch.setattr(tracking_route, "get_tracking_client", lambda: FakeClient())

    response = client.get("/v1/tracking/status")

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["connected"] is False
