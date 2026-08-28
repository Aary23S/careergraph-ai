from datetime import datetime, timedelta, timezone

import pytest

from app.pipelines.leakage import LeakageError, check_no_leakage, mask_if_future

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
BEFORE = T0 - timedelta(days=1)
AFTER = T0 + timedelta(days=1)


def test_mask_if_future_passes_through_when_missing_inputs():
    assert mask_if_future("value", None, T0) == "value"
    assert mask_if_future("value", BEFORE, None) == "value"
    assert mask_if_future(None, AFTER, T0) is None


def test_mask_if_future_keeps_value_when_source_is_before_prediction_time():
    assert mask_if_future("value", BEFORE, T0) == "value"


def test_mask_if_future_keeps_value_when_source_equals_prediction_time():
    assert mask_if_future("value", T0, T0) == "value"


def test_mask_if_future_masks_value_when_source_is_after_prediction_time():
    assert mask_if_future("value", AFTER, T0) is None


def test_check_no_leakage_passes_clean_rows():
    rows = [
        {"application_id": "a1", "prediction_time": T0, "_audit_x": BEFORE},
        {"application_id": "a2", "prediction_time": T0, "_audit_x": None},
    ]
    assert check_no_leakage(rows, ["_audit_x"]) is True


def test_check_no_leakage_raises_on_a_future_source_timestamp():
    rows = [
        {"application_id": "a1", "prediction_time": T0, "_audit_x": AFTER},
    ]
    with pytest.raises(LeakageError):
        check_no_leakage(rows, ["_audit_x"])


def test_check_no_leakage_skips_rows_with_no_prediction_time():
    rows = [{"application_id": "a1", "prediction_time": None, "_audit_x": AFTER}]
    assert check_no_leakage(rows, ["_audit_x"]) is True
