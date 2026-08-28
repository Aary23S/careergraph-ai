from datetime import datetime, timedelta, timezone

from app.pipelines.split import time_based_split

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _row(i):
    return {"application_id": f"a{i}", "prediction_time": T0 + timedelta(days=i)}


def test_empty_input_yields_empty_splits_and_null_cutoffs():
    splits, cutoffs = time_based_split([])
    assert splits == {"train": [], "validation": [], "test": []}
    assert cutoffs == {"train_end": None, "validation_end": None}


def test_splits_are_time_ordered_train_before_validation_before_test():
    rows = [_row(i) for i in range(10)]
    # shuffle input order -- function must sort internally
    shuffled = [rows[3], rows[0], rows[9], rows[1], rows[7], rows[2], rows[8], rows[4], rows[6], rows[5]]

    splits, cutoffs = time_based_split(shuffled, train_fraction=0.7, validation_fraction=0.15)

    assert len(splits["train"]) + len(splits["validation"]) + len(splits["test"]) == 10
    if splits["train"] and splits["validation"]:
        assert splits["train"][-1]["prediction_time"] <= splits["validation"][0]["prediction_time"]
    if splits["validation"] and splits["test"]:
        assert splits["validation"][-1]["prediction_time"] <= splits["test"][0]["prediction_time"]


def test_cutoffs_match_last_row_of_each_split():
    rows = [_row(i) for i in range(10)]
    splits, cutoffs = time_based_split(rows, train_fraction=0.7, validation_fraction=0.15)
    assert cutoffs["train_end"] == splits["train"][-1]["prediction_time"]
    assert cutoffs["validation_end"] == splits["validation"][-1]["prediction_time"]


def test_single_row_goes_to_train_not_lost():
    splits, _cutoffs = time_based_split([_row(0)])
    total = sum(len(v) for v in splits.values())
    assert total == 1
