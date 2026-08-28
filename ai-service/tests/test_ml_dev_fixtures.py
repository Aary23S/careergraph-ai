from app.ml.training.constants import CATEGORICAL_FEATURES, NUMERIC_FEATURES
from app.ml.training.dev_fixtures import build_development_dataset


def test_development_dataset_is_deterministic_given_same_seed():
    a = build_development_dataset(n=50, seed=7)
    b = build_development_dataset(n=50, seed=7)
    assert a["train"] == b["train"]
    assert a["validation"] == b["validation"]
    assert a["test"] == b["test"]


def test_development_dataset_differs_with_different_seed():
    a = build_development_dataset(n=50, seed=1)
    b = build_development_dataset(n=50, seed=2)
    assert a["train"] != b["train"]


def test_development_dataset_is_marked_synthetic():
    dataset = build_development_dataset(n=20, seed=1)
    assert dataset["metadata"]["isSynthetic"] is True
    assert "SYNTHETIC" in dataset["metadata"]["note"]


def test_development_dataset_has_both_label_classes_and_unlabeled_rows():
    dataset = build_development_dataset(n=300, seed=42)
    all_rows = [*dataset["train"], *dataset["validation"], *dataset["test"]]
    labels = [r["outcome_label"] for r in all_rows]
    assert labels.count(1) > 0
    assert labels.count(0) > 0
    assert labels.count(None) > 0
    assert len(all_rows) == 300


def test_development_dataset_rows_carry_every_feature_column():
    dataset = build_development_dataset(n=10, seed=1)
    row = dataset["train"][0]
    for col in NUMERIC_FEATURES + CATEGORICAL_FEATURES:
        assert col in row


def test_development_dataset_status_is_consistent_with_label():
    dataset = build_development_dataset(n=300, seed=42)
    all_rows = [*dataset["train"], *dataset["validation"], *dataset["test"]]
    for row in all_rows:
        if row["outcome_label"] == 1:
            assert row["application_status"] == "accepted"
        elif row["outcome_label"] == 0:
            assert row["application_status"] in ("rejected", "withdrawn")
        else:
            assert row["application_status"] not in ("accepted", "rejected", "withdrawn")


def test_development_dataset_prediction_time_is_ascending_within_each_split():
    dataset = build_development_dataset(n=100, seed=42)
    for split in ("train", "validation", "test"):
        times = [row["prediction_time"] for row in dataset[split]]
        assert times == sorted(times)


def test_development_dataset_splits_are_time_ordered_across_splits():
    dataset = build_development_dataset(n=100, seed=42)
    if dataset["train"] and dataset["validation"]:
        assert dataset["train"][-1]["prediction_time"] <= dataset["validation"][0]["prediction_time"]
    if dataset["validation"] and dataset["test"]:
        assert dataset["validation"][-1]["prediction_time"] <= dataset["test"][0]["prediction_time"]
