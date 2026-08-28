import json

import pytest

from app.ml.training import registry_bridge, train_opportunity_ranker


@pytest.fixture(autouse=True)
def _never_shell_out(monkeypatch):
    monkeypatch.setattr(registry_bridge, "register_candidate_model", lambda **kwargs: {"status": "registered"})


def test_parse_args_defaults():
    args = train_opportunity_ranker.parse_args([])
    assert args.mode == "real"
    assert args.dataset_dir == "datasets"
    assert args.models_dir == "models"
    assert args.no_register is False


def test_parse_args_accepts_development_mode_and_overrides():
    args = train_opportunity_ranker.parse_args(
        ["--mode", "development", "--dev-fixture-size", "50", "--min-positive", "1", "--no-register"]
    )
    assert args.mode == "development"
    assert args.dev_fixture_size == 50
    assert args.min_positive == 1
    assert args.no_register is True


def test_main_development_mode_exits_zero_and_prints_json(tmp_path, capsys):
    exit_code = train_opportunity_ranker.main(
        ["--mode", "development", "--dev-fixture-size", "300", "--models-dir", str(tmp_path / "models")]
    )
    assert exit_code == 0
    printed = json.loads(capsys.readouterr().out)
    assert printed["status"] == "trained"


def test_main_returns_exit_code_3_when_model_not_ready(monkeypatch, tmp_path, capsys):
    from app.ml.training import data as data_module

    tiny_dataset = {
        "train": [{"application_id": "a1", "outcome_label": None, "prediction_time": "2026-01-01T00:00:00+00:00"}],
        "validation": [],
        "test": [],
        "metadata": {"datasetName": "career-opportunity-ranking", "datasetVersion": "v1"},
    }
    monkeypatch.setattr(data_module, "build_accumulated_dataset", lambda *a, **k: tiny_dataset)

    exit_code = train_opportunity_ranker.main(["--mode", "real", "--models-dir", str(tmp_path / "models")])
    assert exit_code == 3
    printed = json.loads(capsys.readouterr().out)
    assert printed["status"] == "MODEL_NOT_READY"


def test_main_returns_exit_code_1_when_dataset_dir_is_missing(tmp_path, capsys):
    exit_code = train_opportunity_ranker.main(
        ["--mode", "real", "--dataset-dir", str(tmp_path / "nonexistent"), "--models-dir", str(tmp_path / "models")]
    )
    assert exit_code == 1
    assert "Training aborted" in capsys.readouterr().err
