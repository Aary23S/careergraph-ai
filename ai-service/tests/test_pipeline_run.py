import json
import os
from datetime import timedelta

import pytest
from pipeline_fixtures import BASE_TIME, make_raw_row

from app.pipelines import extract, pipeline, publish as publish_module
from app.pipelines.pipeline import run_pipeline


class _FakeConnection:
    def close(self):
        pass


@pytest.fixture(autouse=True)
def mock_infra(monkeypatch):
    """Stubs the only two things run_pipeline() needs from a real
    environment: a live Postgres connection and a live MLflow server.
    Everything else (validate/transform/features/split/versioning/quality/
    publish-to-disk) runs for real."""
    monkeypatch.setattr(pipeline, "get_connection", lambda: _FakeConnection())
    monkeypatch.setattr(pipeline, "get_latest_applied_migration", lambda connection=None: "20260828030000")
    mlflow_calls = []
    monkeypatch.setattr(publish_module, "log_complete_run", lambda **kwargs: mlflow_calls.append(kwargs) or {"status": "skipped"})
    return mlflow_calls


def _stub_batches(rows, monkeypatch):
    monkeypatch.setattr(extract, "extract_application_batches", lambda since=None, batch_size=None, connection=None: iter([rows]) if rows else iter([]))
    monkeypatch.setattr(extract, "fetch_connections_for_users", lambda user_ids, connection=None: {})
    monkeypatch.setattr(extract, "fetch_embeddings", lambda keys, connection=None: {})


def test_full_run_produces_a_published_dataset_with_correct_row_count(tmp_path, monkeypatch, mock_infra):
    rows = [
        make_raw_row(application_id="a1", application_status="accepted"),
        make_raw_row(application_id="a2", application_status="rejected", application_created_at=BASE_TIME + timedelta(days=1)),
    ]
    _stub_batches(rows, monkeypatch)

    result = run_pipeline(dataset_version="v1", mode="full", dataset_dir=str(tmp_path))

    assert result["metadata"]["rowCount"] == 2
    assert result["metadata"]["sourceSchemaVersion"] == "20260828030000"
    assert result["observability"]["rows_processed"] == 2
    assert result["observability"]["rows_accepted"] == 2
    assert result["observability"]["rows_rejected"] == 0
    assert os.path.isdir(result["version_dir"])
    assert len(mock_infra) == 1  # MLflow logged once


def test_quarantined_rows_are_excluded_but_do_not_fail_the_run(tmp_path, monkeypatch, mock_infra):
    rows = [
        make_raw_row(application_id="a1"),
        make_raw_row(application_id="a2", user_id=None),  # missing required field
    ]
    _stub_batches(rows, monkeypatch)

    result = run_pipeline(dataset_version="v1", mode="full", dataset_dir=str(tmp_path))

    assert result["metadata"]["rowCount"] == 1
    assert result["observability"]["rows_rejected"] == 1


def test_incremental_mode_passes_checkpoint_as_since(tmp_path, monkeypatch, mock_infra):
    captured = {}

    def fake_batches(since=None, batch_size=None, connection=None):
        captured["since"] = since
        return iter([])

    monkeypatch.setattr(extract, "extract_application_batches", fake_batches)
    monkeypatch.setattr(extract, "fetch_connections_for_users", lambda user_ids, connection=None: {})
    monkeypatch.setattr(extract, "fetch_embeddings", lambda keys, connection=None: {})

    # Seed a checkpoint as if a prior full run had already completed.
    from app.pipelines.checkpoint import write_checkpoint

    write_checkpoint(str(tmp_path), "career-opportunity-ranking", BASE_TIME, "v1")

    run_pipeline(dataset_version="v2", mode="incremental", dataset_dir=str(tmp_path))

    assert captured["since"] == BASE_TIME.isoformat()


def test_checksum_is_reproducible_across_independent_runs_of_identical_data(tmp_path, monkeypatch, mock_infra):
    def make_rows():
        return [make_raw_row(application_id="a1"), make_raw_row(application_id="a2", application_status="rejected")]

    _stub_batches(make_rows(), monkeypatch)
    result_1 = run_pipeline(dataset_version="v1", mode="full", dataset_dir=str(tmp_path))

    _stub_batches(make_rows(), monkeypatch)
    result_2 = run_pipeline(dataset_version="v2", mode="full", dataset_dir=str(tmp_path / "run2"))

    assert result_1["metadata"]["checksum"] == result_2["metadata"]["checksum"]


def test_publishing_the_same_version_twice_is_refused(tmp_path, monkeypatch, mock_infra):
    _stub_batches([make_raw_row(application_id="a1")], monkeypatch)
    run_pipeline(dataset_version="v1", mode="full", dataset_dir=str(tmp_path))

    _stub_batches([make_raw_row(application_id="a1")], monkeypatch)
    with pytest.raises(FileExistsError):
        run_pipeline(dataset_version="v1", mode="full", dataset_dir=str(tmp_path))


def test_published_rows_never_contain_audit_fields_or_are_sent_to_mlflow(tmp_path, monkeypatch, mock_infra):
    # A deliberately distinctive marker value (not a field/key name that
    # could legitimately appear in aggregate schema/quality-report content)
    # so this test can unambiguously assert it never reaches MLflow.
    marker_application_id = "app-unique-marker-4g-privacy-check"
    _stub_batches([make_raw_row(application_id=marker_application_id)], monkeypatch)
    result = run_pipeline(dataset_version="v1", mode="full", dataset_dir=str(tmp_path))

    with open(os.path.join(result["version_dir"], "rows_train.jsonl"), encoding="utf-8") as f:
        published_row = json.loads(f.readline())
    assert not any(k.startswith("_audit_") for k in published_row)
    assert published_row["application_id"] == marker_application_id  # sanity check it really is in the local file

    logged_payload = json.dumps([a["content"] for a in mock_infra[0]["artifacts"]])
    assert marker_application_id not in logged_payload
