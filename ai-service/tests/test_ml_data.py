import json
import os

import pytest

from app.ml.training.data import (
    DatasetNotFoundError,
    all_rows,
    build_accumulated_dataset,
    list_dataset_versions,
    load_dataset_rows,
    resolve_dataset_version,
)


def _write_version(dataset_dir, dataset_name, version, rows_by_split=None, metadata_extra=None):
    version_dir = os.path.join(dataset_dir, dataset_name, version)
    os.makedirs(version_dir, exist_ok=True)
    rows_by_split = rows_by_split or {"train": [], "validation": [], "test": []}
    for split, rows in rows_by_split.items():
        with open(os.path.join(version_dir, f"rows_{split}.jsonl"), "w", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row) + "\n")
    metadata = {"datasetName": dataset_name, "datasetVersion": version, **(metadata_extra or {})}
    with open(os.path.join(version_dir, "dataset-metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f)
    return version_dir


def test_list_dataset_versions_empty_when_missing(tmp_path):
    assert list_dataset_versions(str(tmp_path), "nope") == []


def test_list_dataset_versions_sorted_chronologically(tmp_path):
    _write_version(str(tmp_path), "career-opportunity-ranking", "v20260101T000000Z")
    _write_version(str(tmp_path), "career-opportunity-ranking", "v20260301T000000Z")
    _write_version(str(tmp_path), "career-opportunity-ranking", "v20260201T000000Z")
    versions = list_dataset_versions(str(tmp_path), "career-opportunity-ranking")
    assert versions == ["v20260101T000000Z", "v20260201T000000Z", "v20260301T000000Z"]


def test_list_dataset_versions_ignores_checkpoint_file(tmp_path):
    dataset_root = os.path.join(str(tmp_path), "career-opportunity-ranking")
    os.makedirs(dataset_root, exist_ok=True)
    with open(os.path.join(dataset_root, ".checkpoint.json"), "w", encoding="utf-8") as f:
        f.write("{}")
    _write_version(str(tmp_path), "career-opportunity-ranking", "v1")
    assert list_dataset_versions(str(tmp_path), "career-opportunity-ranking") == ["v1"]


def test_resolve_dataset_version_defaults_to_latest(tmp_path):
    _write_version(str(tmp_path), "ds", "v1")
    _write_version(str(tmp_path), "ds", "v2")
    assert resolve_dataset_version(str(tmp_path), "ds") == "v2"


def test_resolve_dataset_version_explicit(tmp_path):
    _write_version(str(tmp_path), "ds", "v1")
    _write_version(str(tmp_path), "ds", "v2")
    assert resolve_dataset_version(str(tmp_path), "ds", version="v1") == "v1"


def test_resolve_dataset_version_raises_when_no_versions(tmp_path):
    with pytest.raises(DatasetNotFoundError):
        resolve_dataset_version(str(tmp_path), "ds")


def test_resolve_dataset_version_raises_when_explicit_version_missing(tmp_path):
    _write_version(str(tmp_path), "ds", "v1")
    with pytest.raises(DatasetNotFoundError):
        resolve_dataset_version(str(tmp_path), "ds", version="v99")


def test_load_dataset_rows_reads_all_splits(tmp_path):
    rows = {
        "train": [{"application_id": "a1", "outcome_label": 1}],
        "validation": [{"application_id": "a2", "outcome_label": None}],
        "test": [{"application_id": "a3", "outcome_label": 0}],
    }
    _write_version(str(tmp_path), "ds", "v1", rows_by_split=rows, metadata_extra={"featureVersion": "v1"})
    dataset = load_dataset_rows(str(tmp_path), "ds", "v1")
    assert [r["application_id"] for r in dataset["train"]] == ["a1"]
    assert [r["application_id"] for r in dataset["validation"]] == ["a2"]
    assert [r["application_id"] for r in dataset["test"]] == ["a3"]
    assert dataset["metadata"]["featureVersion"] == "v1"


def test_load_dataset_rows_missing_version_raises(tmp_path):
    with pytest.raises(DatasetNotFoundError):
        load_dataset_rows(str(tmp_path), "ds", "vmissing")


def test_all_rows_flattens_every_split():
    dataset = {
        "train": [{"application_id": "1"}],
        "validation": [{"application_id": "2"}],
        "test": [{"application_id": "3"}, {"application_id": "4"}],
        "metadata": {},
    }
    flattened = all_rows(dataset)
    assert [r["application_id"] for r in flattened] == ["1", "2", "3", "4"]


def test_build_accumulated_dataset_raises_when_nothing_published(tmp_path):
    with pytest.raises(DatasetNotFoundError):
        build_accumulated_dataset(str(tmp_path), "ds")


def test_build_accumulated_dataset_raises_when_only_incremental_versions_exist(tmp_path):
    _write_version(str(tmp_path), "ds", "v1", metadata_extra={"mode": "incremental"})
    with pytest.raises(DatasetNotFoundError):
        build_accumulated_dataset(str(tmp_path), "ds")


def test_build_accumulated_dataset_uses_full_version_alone_when_no_incrementals_follow(tmp_path):
    _write_version(
        str(tmp_path), "ds", "v1",
        rows_by_split={"train": [{"application_id": "a1"}], "validation": [], "test": []},
        metadata_extra={"mode": "full"},
    )
    dataset = build_accumulated_dataset(str(tmp_path), "ds")
    assert [r["application_id"] for r in dataset["train"]] == ["a1"]
    assert dataset["metadata"]["accumulatedFromVersions"] == ["v1"]


def test_build_accumulated_dataset_appends_incremental_deltas_published_after_the_anchor(tmp_path):
    """Regression test for the real bug found during Phase 4H live
    verification: the lexicographically-latest published version was a
    0-row incremental snapshot, which silently discarded the one full
    extraction containing the actual 8 real application rows."""
    _write_version(
        str(tmp_path), "ds", "v1-full",
        rows_by_split={"train": [{"application_id": "a1"}], "validation": [{"application_id": "a2"}], "test": []},
        metadata_extra={"mode": "full"},
    )
    _write_version(
        str(tmp_path), "ds", "v2-incremental",
        rows_by_split={"train": [{"application_id": "a3"}], "validation": [], "test": []},
        metadata_extra={"mode": "incremental"},
    )
    _write_version(
        str(tmp_path), "ds", "v3-incremental-empty",
        rows_by_split={"train": [], "validation": [], "test": []},
        metadata_extra={"mode": "incremental"},
    )

    dataset = build_accumulated_dataset(str(tmp_path), "ds")
    assert [r["application_id"] for r in dataset["train"]] == ["a1", "a3"]
    assert [r["application_id"] for r in dataset["validation"]] == ["a2"]
    assert dataset["metadata"]["accumulatedFromVersions"] == ["v1-full", "v2-incremental", "v3-incremental-empty"]


def test_build_accumulated_dataset_anchors_on_the_most_recent_full_version(tmp_path):
    _write_version(str(tmp_path), "ds", "v1-full", rows_by_split={"train": [{"application_id": "old"}], "validation": [], "test": []}, metadata_extra={"mode": "full"})
    _write_version(str(tmp_path), "ds", "v2-full", rows_by_split={"train": [{"application_id": "new"}], "validation": [], "test": []}, metadata_extra={"mode": "full"})

    dataset = build_accumulated_dataset(str(tmp_path), "ds")
    assert [r["application_id"] for r in dataset["train"]] == ["new"]
    assert dataset["metadata"]["accumulatedFromVersions"] == ["v2-full"]
