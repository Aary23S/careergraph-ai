"""Phase 4H section 5 -- 'create tests for obvious leakage', specifically at
the training-time feature-selection boundary. Phase 4G's own leakage tests
(temporal masking during extraction/transform) already cover the earlier
stage of the pipeline; these tests cover the later stage this phase adds:
even if a row somehow carried a leakage-sensitive field, it must never
reach the model as an input.
"""
from app.ml.training.constants import CATEGORICAL_FEATURES, EXCLUDED_FROM_FEATURES, FEATURE_COLUMNS, NUMERIC_FEATURES
from app.ml.training.features import to_frame


def test_feature_columns_never_include_identifiers_or_label_fields():
    assert set(FEATURE_COLUMNS).isdisjoint(EXCLUDED_FROM_FEATURES)


def test_excluded_fields_cover_every_identifier_and_the_label():
    for field in ("application_id", "user_id", "job_id", "company_id", "resume_id", "prediction_time", "application_status", "outcome_label"):
        assert field in EXCLUDED_FROM_FEATURES


def test_feature_columns_is_exactly_numeric_plus_categorical():
    assert FEATURE_COLUMNS == NUMERIC_FEATURES + CATEGORICAL_FEATURES


def test_a_row_carrying_the_label_never_leaks_it_into_the_frame():
    row = {
        "application_id": "should-never-appear",
        "user_id": "should-never-appear",
        "job_id": "should-never-appear",
        "company_id": "should-never-appear",
        "resume_id": "should-never-appear",
        "prediction_time": "2099-01-01T00:00:00+00:00",
        "application_status": "accepted",
        "outcome_label": 1,
        "skill_overlap": 0.9,
    }
    frame = to_frame([row])
    for leaked_field in EXCLUDED_FROM_FEATURES:
        assert leaked_field not in frame.columns


def test_a_future_dated_row_still_only_yields_declared_feature_columns():
    """This does not re-test Phase 4G's temporal masking itself (that's
    app.pipelines.leakage's job, already covered in test_pipeline_leakage.py)
    -- it confirms the training layer's own column boundary holds regardless
    of what timestamp a row happens to carry."""
    row = {"prediction_time": "2099-01-01T00:00:00+00:00", "job_role_category": "Engineer"}
    frame = to_frame([row])
    assert set(frame.columns) == set(FEATURE_COLUMNS)
