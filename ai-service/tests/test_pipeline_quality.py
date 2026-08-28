from app.pipelines.quality import EXPECTED_FIELDS, build_quality_report


def _complete_row(**overrides):
    row = {field: "x" for field in EXPECTED_FIELDS}
    row["outcome_label"] = 1
    row["skill_overlap"] = 0.5
    row["domain_overlap"] = 0.5
    row["semantic_similarity"] = 0.5
    row["experience_compatibility"] = 0.5
    row["has_company_connection"] = 1.0
    row["connection_relevance"] = 0.5
    row.update(overrides)
    return row


def test_healthy_report_for_clean_rows():
    rows = [_complete_row(application_id="a1"), _complete_row(application_id="a2", outcome_label=0)]
    report = build_quality_report(rows)
    assert report["totalRows"] == 2
    assert report["duplicateCount"] == 0
    assert report["schemaIssues"] == []
    assert report["healthy"] is True
    assert report["labelDistribution"] == {"positive": 1, "negative": 1, "unlabeled": 0}


def test_null_rates_computed_per_field():
    rows = [_complete_row(application_id="a1", skill_overlap=None), _complete_row(application_id="a2")]
    report = build_quality_report(rows)
    assert report["nullRates"]["skill_overlap"] == 0.5


def test_out_of_range_feature_value_is_detected():
    rows = [_complete_row(application_id="a1", skill_overlap=1.5)]
    report = build_quality_report(rows)
    assert report["outOfRangeCounts"]["skill_overlap"] == 1
    assert report["healthy"] is False


def test_duplicate_application_id_is_detected():
    rows = [_complete_row(application_id="a1"), _complete_row(application_id="a1")]
    report = build_quality_report(rows)
    assert report["duplicateCount"] == 1
    assert report["healthy"] is False


def test_missing_field_is_a_schema_issue():
    row = _complete_row(application_id="a1")
    del row["skill_overlap"]
    report = build_quality_report([row])
    assert len(report["schemaIssues"]) == 1
    assert report["healthy"] is False


def test_unlabeled_rows_counted_separately():
    rows = [_complete_row(application_id="a1", outcome_label=None)]
    report = build_quality_report(rows)
    assert report["labelDistribution"]["unlabeled"] == 1


def test_empty_dataset_does_not_divide_by_zero():
    report = build_quality_report([])
    assert report["totalRows"] == 0
    assert all(rate == 0.0 for rate in report["nullRates"].values())
