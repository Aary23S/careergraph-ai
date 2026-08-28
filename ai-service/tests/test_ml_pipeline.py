"""Phase 4H -- end-to-end orchestration tests for run_training(). MLflow is
never actually contacted here (settings.mlflow_enabled defaults False in
tests, so log_complete_run() is already a guaranteed no-op per Phase 4F/4G's
own tests) and the Model Registry CLI subprocess is always monkeypatched
out, so these tests never touch Node, Postgres, or a network.
"""
import os

import pytest

from app.ml.training import registry_bridge
from app.ml.training.data import DatasetNotFoundError
from app.ml.training.pipeline import MODEL_NOT_READY, run_training


@pytest.fixture(autouse=True)
def _never_actually_shell_out_to_node(monkeypatch):
    monkeypatch.setattr(
        registry_bridge,
        "register_candidate_model",
        lambda **kwargs: {"status": "registered", "stdout": "fake"},
    )


def test_development_mode_trains_end_to_end(tmp_path):
    result = run_training(
        mode="development",
        models_dir=str(tmp_path / "models"),
        dev_fixture_size=150,
        dev_fixture_seed=42,
    )

    assert result["status"] == "trained"
    assert result["isDevelopmentOnly"] is True
    assert result["productionReady"] is False
    assert os.path.exists(result["modelPath"])
    assert result["checksum"]
    assert result["metricsBySplit"]["train"]["status"] == "computed"
    assert result["registry"]["status"] == "registered"


def test_development_mode_writes_metadata_and_evaluation_files(tmp_path):
    result = run_training(mode="development", models_dir=str(tmp_path / "models"), dev_fixture_size=150)
    version_dir = os.path.dirname(result["modelPath"])
    assert os.path.exists(os.path.join(version_dir, "model-metadata.json"))
    assert os.path.exists(os.path.join(version_dir, "evaluation-results.json"))


def test_development_mode_is_reproducible_given_same_seed(tmp_path):
    result_a = run_training(mode="development", models_dir=str(tmp_path / "a"), dev_fixture_size=100, dev_fixture_seed=99, model_version="fixed")
    result_b = run_training(mode="development", models_dir=str(tmp_path / "b"), dev_fixture_size=100, dev_fixture_seed=99, model_version="fixed")
    assert result_a["checksum"] == result_b["checksum"]


def test_real_mode_with_insufficient_labels_returns_model_not_ready(monkeypatch, tmp_path):
    from app.ml.training import data as data_module

    tiny_dataset = {
        "train": [{"application_id": "a1", "outcome_label": 0, "prediction_time": "2026-01-01T00:00:00+00:00", "job_id": "j1"}],
        "validation": [],
        "test": [],
        "metadata": {"datasetName": "career-opportunity-ranking", "datasetVersion": "v1", "featureVersion": "v1"},
    }
    monkeypatch.setattr(data_module, "build_accumulated_dataset", lambda *a, **k: tiny_dataset)

    result = run_training(mode="real", models_dir=str(tmp_path / "models"))
    assert result["status"] == MODEL_NOT_READY
    assert result["reason"] == "insufficient_labeled_data"
    assert result["labelSummary"]["positive"] == 0
    assert result["labelSummary"]["negative"] == 1
    assert not os.path.isdir(tmp_path / "models")


def test_real_mode_never_calls_registry_when_not_ready(monkeypatch, tmp_path):
    called = {"yes": False}

    def _fail_if_called(**kwargs):
        called["yes"] = True
        return {"status": "registered"}

    monkeypatch.setattr(registry_bridge, "register_candidate_model", _fail_if_called)

    from app.ml.training import data as data_module

    tiny_dataset = {
        "train": [{"application_id": "a1", "outcome_label": None, "prediction_time": "2026-01-01T00:00:00+00:00"}],
        "validation": [],
        "test": [],
        "metadata": {"datasetName": "career-opportunity-ranking", "datasetVersion": "v1"},
    }
    monkeypatch.setattr(data_module, "build_accumulated_dataset", lambda *a, **k: tiny_dataset)

    run_training(mode="real", models_dir=str(tmp_path / "models"))
    assert called["yes"] is False


def test_real_mode_with_no_published_dataset_raises_dataset_not_found(tmp_path):
    with pytest.raises(DatasetNotFoundError):
        run_training(mode="real", dataset_dir=str(tmp_path / "nonexistent"), models_dir=str(tmp_path / "models"))


def test_no_register_flag_skips_the_registry_bridge_entirely(monkeypatch, tmp_path):
    called = {"yes": False}
    monkeypatch.setattr(registry_bridge, "register_candidate_model", lambda **kwargs: called.__setitem__("yes", True))

    result = run_training(mode="development", models_dir=str(tmp_path / "models"), dev_fixture_size=100, register_candidate=False)
    assert called["yes"] is False
    assert result["registry"]["status"] == "skipped"


def test_invalid_mode_raises_value_error(tmp_path):
    with pytest.raises(ValueError):
        run_training(mode="production", models_dir=str(tmp_path / "models"))
