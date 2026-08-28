from app.pipelines.versioning import build_metadata, compute_checksum


def test_checksum_is_deterministic_regardless_of_row_order():
    rows_a = [{"application_id": "a1", "x": 1}, {"application_id": "a2", "x": 2}]
    rows_b = [{"application_id": "a2", "x": 2}, {"application_id": "a1", "x": 1}]
    assert compute_checksum(rows_a) == compute_checksum(rows_b)


def test_checksum_changes_with_content():
    rows_a = [{"application_id": "a1", "x": 1}]
    rows_b = [{"application_id": "a1", "x": 2}]
    assert compute_checksum(rows_a) != compute_checksum(rows_b)


def test_checksum_is_reproducible_across_independent_calls():
    rows = [{"application_id": "a1", "x": 1}, {"application_id": "a2", "x": 2}]
    assert compute_checksum(rows) == compute_checksum(list(rows))


def test_checksum_handles_datetime_values():
    from datetime import datetime, timezone

    rows = [{"application_id": "a1", "ts": datetime(2026, 1, 1, tzinfo=timezone.utc)}]
    # Must not raise (datetime isn't natively JSON-serializable -- relies on default=str)
    checksum = compute_checksum(rows)
    assert isinstance(checksum, str) and len(checksum) == 64  # sha256 hex digest length


def test_build_metadata_contains_all_required_fields():
    metadata = build_metadata(
        dataset_name="career-opportunity-ranking",
        dataset_version="v1",
        source_schema_version="20260828030000",
        feature_version="v1",
        row_count=5,
        checksum="abc123",
    )
    for field in ["datasetName", "datasetVersion", "sourceSchemaVersion", "featureVersion", "rowCount", "checksum", "createdAt", "gitCommit"]:
        assert field in metadata
    assert metadata["rowCount"] == 5
    assert metadata["checksum"] == "abc123"
