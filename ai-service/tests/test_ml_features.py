import math

from app.ml.training.constants import CATEGORICAL_FEATURES, FEATURE_COLUMNS, NUMERIC_FEATURES
from app.ml.training.features import MISSING_CATEGORY, extract_labels, filter_labeled, to_frame


def test_filter_labeled_excludes_none():
    rows = [{"outcome_label": 1}, {"outcome_label": 0}, {"outcome_label": None}]
    assert len(filter_labeled(rows)) == 2


def test_extract_labels_returns_ints():
    rows = [{"outcome_label": 1}, {"outcome_label": 0}]
    assert extract_labels(rows) == [1, 0]


def test_to_frame_has_exactly_feature_columns_in_order():
    rows = [{"skill_overlap": 0.5, "job_role_category": "Engineer"}]
    frame = to_frame(rows)
    assert list(frame.columns) == FEATURE_COLUMNS


def test_to_frame_ignores_extra_keys_on_the_row():
    row = {
        "application_id": "leaky-id",
        "application_status": "accepted",
        "outcome_label": 1,
        "skill_overlap": 0.5,
    }
    frame = to_frame([row])
    assert "application_id" not in frame.columns
    assert "application_status" not in frame.columns
    assert "outcome_label" not in frame.columns


def test_to_frame_numeric_missing_becomes_nan():
    frame = to_frame([{"skill_overlap": None}])
    assert math.isnan(frame.loc[0, "skill_overlap"])


def test_to_frame_numeric_present_is_float():
    frame = to_frame([{"skill_overlap": 0.75}])
    assert frame.loc[0, "skill_overlap"] == 0.75


def test_to_frame_categorical_missing_becomes_sentinel():
    frame = to_frame([{"job_role_category": None}])
    assert frame.loc[0, "job_role_category"] == MISSING_CATEGORY


def test_to_frame_categorical_present_is_string():
    frame = to_frame([{"job_seniority": "senior"}])
    assert frame.loc[0, "job_seniority"] == "senior"


def test_to_frame_handles_completely_empty_row():
    frame = to_frame([{}])
    for col in NUMERIC_FEATURES:
        assert math.isnan(frame.loc[0, col])
    for col in CATEGORICAL_FEATURES:
        assert frame.loc[0, col] == MISSING_CATEGORY
