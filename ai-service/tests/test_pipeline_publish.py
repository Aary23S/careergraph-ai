import json
import os

import pytest

from app.pipelines import publish as publish_module
from app.pipelines.publish import publish_dataset
from app.pipelines.versioning import build_metadata, compute_checksum


def _sample_splits():
    rows = [
        {"application_id": "a1", "user_id": "u1", "outcome_label": 1, "_audit_x": None},
        {"application_id": "a2", "user_id": "u1", "outcome_label": 0, "_audit_x": None},
    ]
    return {"train": rows, "validation": [], "test": []}


def _sample_metadata(rows):
    checksum = compute_checksum(rows)
    return build_metadata(
        dataset_name="career-opportunity-ranking",
        dataset_version="v1",
        source_schema_version="20260101000000",
        feature_version="v1",
        row_count=len(rows),
        checksum=checksum,
    )


@pytest.fixture(autouse=True)
def mock_mlflow(monkeypatch):
    calls = []
    monkeypatch.setattr(publish_module, "log_complete_run", lambda **kwargs: calls.append(kwargs) or {"status": "skipped"})
    return calls


def test_publish_writes_row_files_metadata_schema_and_quality_report(tmp_path):
    splits = _sample_splits()
    all_rows = splits["train"]
    metadata = _sample_metadata(all_rows)
    quality_report = {"healthy": True, "totalRows": 2}

    version_dir = publish_dataset(str(tmp_path), "career-opportunity-ranking", "v1", splits, metadata, quality_report, {})

    assert os.path.isfile(os.path.join(version_dir, "rows_train.jsonl"))
    assert os.path.isfile(os.path.join(version_dir, "rows_validation.jsonl"))
    assert os.path.isfile(os.path.join(version_dir, "rows_test.jsonl"))
    assert os.path.isfile(os.path.join(version_dir, "dataset-metadata.json"))
    assert os.path.isfile(os.path.join(version_dir, "feature-schema.json"))
    assert os.path.isfile(os.path.join(version_dir, "quality-report.json"))

    with open(os.path.join(version_dir, "rows_train.jsonl"), encoding="utf-8") as f:
        lines = [json.loads(line) for line in f]
    assert len(lines) == 2
    assert "_audit_x" not in lines[0]  # audit fields stripped before publish


def test_publish_refuses_to_overwrite_an_existing_version(tmp_path):
    splits = _sample_splits()
    metadata = _sample_metadata(splits["train"])
    publish_dataset(str(tmp_path), "career-opportunity-ranking", "v1", splits, metadata, {"healthy": True}, {})

    with pytest.raises(FileExistsError):
        publish_dataset(str(tmp_path), "career-opportunity-ranking", "v1", splits, metadata, {"healthy": True}, {})


def test_publish_logs_to_mlflow_with_only_the_three_safe_artifacts(tmp_path, mock_mlflow):
    splits = _sample_splits()
    metadata = _sample_metadata(splits["train"])
    publish_dataset(str(tmp_path), "career-opportunity-ranking", "v1", splits, metadata, {"healthy": True}, {"rows_processed": 2})

    assert len(mock_mlflow) == 1
    call = mock_mlflow[0]
    assert call["experiment_suffix"] == "dataset-pipeline"
    artifact_names = {a["name"] for a in call["artifacts"]}
    assert artifact_names == {"dataset-metadata.json", "feature-schema.json", "quality-report.json"}
    # Never actual per-application row data (the two rows from
    # _sample_splits() have outcome_label 1 and 0, and no third value) --
    # feature-schema.json legitimately documents field *names* like
    # "outcome_label", which is fine; it's the metadata/quality-report
    # artifacts that must carry no row-level content at all.
    non_schema_artifacts = [a for a in call["artifacts"] if a["name"] != "feature-schema.json"]
    for artifact in non_schema_artifacts:
        assert "application_id" not in json.dumps(artifact["content"])
    assert call["params"]["datasetName"] == "career-opportunity-ranking"
    assert call["metrics"]["rows_processed"] == 2
    assert call["tags"]["checksum"] == metadata["checksum"]
