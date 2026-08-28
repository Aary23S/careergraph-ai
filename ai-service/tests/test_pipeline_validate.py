from pipeline_fixtures import make_raw_row

from app.pipelines.validate import validate_batch


def test_valid_rows_pass_through():
    rows = [make_raw_row(application_id="a1"), make_raw_row(application_id="a2")]
    valid, quarantined = validate_batch(rows, set())
    assert len(valid) == 2
    assert quarantined == []


def test_missing_required_field_is_quarantined():
    rows = [make_raw_row(application_id="a1", user_id=None)]
    valid, quarantined = validate_batch(rows, set())
    assert valid == []
    assert len(quarantined) == 1
    assert "missing_required_field:user_id" in quarantined[0]["reasons"]


def test_duplicate_within_batch_is_quarantined():
    rows = [make_raw_row(application_id="a1"), make_raw_row(application_id="a1")]
    valid, quarantined = validate_batch(rows, set())
    assert len(valid) == 1
    assert len(quarantined) == 1
    assert "duplicate_application_id" in quarantined[0]["reasons"]


def test_duplicate_across_batches_is_caught_via_seen_ids():
    seen = {"a1"}
    rows = [make_raw_row(application_id="a1")]
    valid, quarantined = validate_batch(rows, seen)
    assert valid == []
    assert "duplicate_application_id" in quarantined[0]["reasons"]


def test_unknown_status_is_quarantined():
    rows = [make_raw_row(application_id="a1", application_status="ghosted")]
    valid, quarantined = validate_batch(rows, set())
    assert valid == []
    assert any(r.startswith("unknown_application_status") for r in quarantined[0]["reasons"])


def test_valid_row_is_added_to_seen_ids_for_future_batches():
    seen = set()
    rows = [make_raw_row(application_id="a1")]
    validate_batch(rows, seen)
    assert "a1" in seen
