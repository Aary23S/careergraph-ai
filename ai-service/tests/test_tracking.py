from unittest.mock import MagicMock

import pytest

from app.config import settings
from app.tracking import mlflow_client as tracking_module
from app.tracking.mlflow_client import MLflowTrackingClient, log_complete_run


class FakeRun:
    def __init__(self, run_id="run-123"):
        self.info = MagicMock(run_id=run_id)


@pytest.fixture(autouse=True)
def reset_settings():
    original_enabled = settings.mlflow_enabled
    yield
    settings.mlflow_enabled = original_enabled
    tracking_module.get_tracking_client.cache_clear()


def test_disabled_by_default_every_method_is_a_noop():
    settings.mlflow_enabled = False
    client = MLflowTrackingClient()

    assert client.start_run("job-enrichment") is None
    assert client.log_params({"a": 1}) is False
    assert client.log_metrics({"a": 1}) is False
    assert client.log_tags({"a": "b"}) is False
    assert client.log_artifact("x.json", {"a": 1}) is False
    assert client.end_run() is False
    assert client.is_available() is False
    assert client.get_last_run_summary() is None


def test_start_run_creates_experiment_and_auto_tags(monkeypatch):
    settings.mlflow_enabled = True
    fake_mlflow = MagicMock()
    fake_mlflow.start_run.return_value = FakeRun()
    monkeypatch.setattr(tracking_module, "mlflow", fake_mlflow)

    client = MLflowTrackingClient()
    run = client.start_run("embeddings", run_name="test-run")

    fake_mlflow.set_tracking_uri.assert_called_once_with(settings.mlflow_tracking_uri)
    fake_mlflow.set_experiment.assert_called_once_with("careergraph-embeddings")
    fake_mlflow.start_run.assert_called_once_with(run_name="test-run")
    assert run is not None

    fake_mlflow.set_tags.assert_called_once()
    tags_arg = fake_mlflow.set_tags.call_args[0][0]
    assert "gitCommit" in tags_arg
    assert "pythonVersion" in tags_arg


def test_logging_before_start_run_is_a_noop(monkeypatch):
    settings.mlflow_enabled = True
    fake_mlflow = MagicMock()
    monkeypatch.setattr(tracking_module, "mlflow", fake_mlflow)
    client = MLflowTrackingClient()

    assert client.log_params({"model": "x"}) is False
    assert client.log_metrics({"score": 1.0}) is False
    fake_mlflow.log_params.assert_not_called()
    fake_mlflow.log_metrics.assert_not_called()


def test_log_metrics_filters_non_numeric_values(monkeypatch):
    settings.mlflow_enabled = True
    fake_mlflow = MagicMock()
    fake_mlflow.start_run.return_value = FakeRun()
    monkeypatch.setattr(tracking_module, "mlflow", fake_mlflow)
    client = MLflowTrackingClient()
    client.start_run("job-enrichment")

    ok = client.log_metrics({"score": 0.9, "label": "not-a-number", "count": 3})

    assert ok is True
    logged = fake_mlflow.log_metrics.call_args[0][0]
    assert logged == {"score": 0.9, "count": 3.0}


def test_log_artifact_writes_json_to_a_temp_file(monkeypatch):
    settings.mlflow_enabled = True
    fake_mlflow = MagicMock()
    fake_mlflow.start_run.return_value = FakeRun()
    monkeypatch.setattr(tracking_module, "mlflow", fake_mlflow)
    client = MLflowTrackingClient()
    client.start_run("embeddings")

    ok = client.log_artifact("evaluation-results.json", {"cases": 5})

    assert ok is True
    fake_mlflow.log_artifact.assert_called_once()
    logged_path = fake_mlflow.log_artifact.call_args[0][0]
    assert logged_path.endswith("evaluation-results.json")


def test_end_run_clears_active_run_so_further_logging_is_a_noop(monkeypatch):
    settings.mlflow_enabled = True
    fake_mlflow = MagicMock()
    fake_mlflow.start_run.return_value = FakeRun()
    monkeypatch.setattr(tracking_module, "mlflow", fake_mlflow)
    client = MLflowTrackingClient()
    client.start_run("outreach")

    assert client.end_run() is True
    fake_mlflow.end_run.assert_called_once_with(status="FINISHED")
    assert client.log_params({"a": 1}) is False


def test_start_run_failure_is_isolated_not_raised(monkeypatch):
    """MLflow throwing during start_run must never propagate -- callers get
    None back, exactly like the disabled case, and AI inference is
    unaffected either way (section 13: failure isolation)."""
    settings.mlflow_enabled = True
    fake_mlflow = MagicMock()
    fake_mlflow.set_experiment.side_effect = Exception("tracking server unreachable")
    monkeypatch.setattr(tracking_module, "mlflow", fake_mlflow)
    client = MLflowTrackingClient()

    run = client.start_run("job-enrichment")

    assert run is None


def test_end_run_failure_is_isolated_not_raised(monkeypatch):
    settings.mlflow_enabled = True
    fake_mlflow = MagicMock()
    fake_mlflow.start_run.return_value = FakeRun()
    fake_mlflow.end_run.side_effect = Exception("timeout")
    monkeypatch.setattr(tracking_module, "mlflow", fake_mlflow)
    client = MLflowTrackingClient()
    client.start_run("job-enrichment")

    assert client.end_run() is False


def test_is_available_false_when_disabled():
    settings.mlflow_enabled = False
    assert MLflowTrackingClient().is_available() is False


def test_is_available_handles_connection_failure(monkeypatch):
    settings.mlflow_enabled = True
    monkeypatch.setattr(tracking_module, "_MlflowSdkClient", MagicMock(side_effect=Exception("connection refused")))
    assert MLflowTrackingClient().is_available() is False


def test_is_available_true_when_reachable(monkeypatch):
    settings.mlflow_enabled = True
    fake_sdk_client = MagicMock()
    monkeypatch.setattr(tracking_module, "_MlflowSdkClient", MagicMock(return_value=fake_sdk_client))
    assert MLflowTrackingClient().is_available() is True


def test_get_last_run_summary_none_when_no_experiments(monkeypatch):
    settings.mlflow_enabled = True
    fake_sdk_client = MagicMock()
    fake_sdk_client.search_experiments.return_value = []
    monkeypatch.setattr(tracking_module, "_MlflowSdkClient", MagicMock(return_value=fake_sdk_client))
    assert MLflowTrackingClient().get_last_run_summary() is None


def test_get_last_run_summary_returns_most_recent_run(monkeypatch):
    settings.mlflow_enabled = True
    fake_experiment = MagicMock(experiment_id="1")
    fake_experiment.name = "careergraph-embeddings"
    fake_run = MagicMock()
    fake_run.info.experiment_id = "1"
    fake_run.info.run_id = "run-xyz"
    fake_run.info.status = "FINISHED"
    fake_run.data.tags = {"model": "all-MiniLM-L6-v2"}
    fake_run.data.params = {}
    fake_run.info.start_time = 1000

    fake_sdk_client = MagicMock()
    fake_sdk_client.search_experiments.return_value = [fake_experiment]
    fake_sdk_client.search_runs.return_value = [fake_run]
    monkeypatch.setattr(tracking_module, "_MlflowSdkClient", MagicMock(return_value=fake_sdk_client))

    summary = MLflowTrackingClient().get_last_run_summary()

    assert summary == {
        "experiment": "careergraph-embeddings",
        "runId": "run-xyz",
        "status": "FINISHED",
        "model": "all-MiniLM-L6-v2",
        "startedAt": 1000,
    }


def test_log_complete_run_skips_when_disabled():
    settings.mlflow_enabled = False
    result = log_complete_run("job-enrichment", params={"model": "x"})
    assert result == {"status": "skipped", "reason": "mlflow_disabled_or_unavailable", "runId": None, "experiment": None}


def test_log_complete_run_logs_params_metrics_tags_and_artifacts(monkeypatch):
    settings.mlflow_enabled = True
    fake_mlflow = MagicMock()
    fake_mlflow.start_run.return_value = FakeRun(run_id="abc-123")
    monkeypatch.setattr(tracking_module, "mlflow", fake_mlflow)
    tracking_module.get_tracking_client.cache_clear()

    result = log_complete_run(
        "embeddings",
        params={"model": "all-MiniLM-L6-v2"},
        metrics={"avg_latency_ms": 120.0},
        tags={"modelRegistryId": "reg-1"},
        artifacts=[{"name": "benchmark-results.json", "content": {"ok": True}}],
    )

    assert result == {"status": "logged", "runId": "abc-123", "experiment": "careergraph-embeddings"}
    fake_mlflow.log_params.assert_called_once()
    fake_mlflow.log_metrics.assert_called_once()
    fake_mlflow.log_artifact.assert_called_once()
    fake_mlflow.end_run.assert_called_once()


def test_log_complete_run_ignores_malformed_artifact_entries(monkeypatch):
    settings.mlflow_enabled = True
    fake_mlflow = MagicMock()
    fake_mlflow.start_run.return_value = FakeRun()
    monkeypatch.setattr(tracking_module, "mlflow", fake_mlflow)
    tracking_module.get_tracking_client.cache_clear()

    result = log_complete_run("embeddings", artifacts=[{"name": "no-content-field"}, {"content": {"a": 1}}])

    assert result["status"] == "logged"
    fake_mlflow.log_artifact.assert_not_called()
