"""Phase 4G -- dataset-level data quality report (section 9).

Runs over the final, transformed/feature-engineered rows (post
validate.py's raw-row rejection). Produces `quality-report.json` --
null rates, duplicate check, out-of-range feature values, label
distribution, and a schema check. This module only *reports*; it does not
itself drop rows (validate.py already rejected structurally-broken raw rows
before this point) -- callers can decide what to do with an unhealthy report.
"""

EXPECTED_FIELDS = [
    "application_id", "user_id", "job_id", "company_id", "resume_id", "prediction_time",
    "job_role_category", "job_seniority", "job_employment_type", "job_remote_type", "resume_career_level",
    "skill_overlap", "domain_overlap", "semantic_similarity", "experience_compatibility",
    "has_company_connection", "connection_relevance",
    "application_status", "outcome_label",
]

# (min, max) inclusive; None bound = unbounded on that side.
FEATURE_RANGES = {
    "skill_overlap": (0.0, 1.0),
    "domain_overlap": (0.0, 1.0),
    "semantic_similarity": (-1.0, 1.0),
    "experience_compatibility": (0.0, 1.0),
    "has_company_connection": (0.0, 1.0),
    "connection_relevance": (0.0, 1.0),
}


def build_quality_report(rows):
    total = len(rows)
    schema_issues = []
    null_counts = {field: 0 for field in EXPECTED_FIELDS}
    out_of_range = {field: 0 for field in FEATURE_RANGES}
    seen_ids = set()
    duplicate_count = 0
    label_counts = {"positive": 0, "negative": 0, "unlabeled": 0}

    for row in rows:
        missing_fields = [f for f in EXPECTED_FIELDS if f not in row]
        if missing_fields:
            schema_issues.append({"application_id": row.get("application_id"), "missing_fields": missing_fields})

        for field in EXPECTED_FIELDS:
            if row.get(field) is None:
                null_counts[field] += 1

        for field, (lo, hi) in FEATURE_RANGES.items():
            value = row.get(field)
            if value is None:
                continue
            if (lo is not None and value < lo) or (hi is not None and value > hi):
                out_of_range[field] += 1

        application_id = row.get("application_id")
        if application_id in seen_ids:
            duplicate_count += 1
        else:
            seen_ids.add(application_id)

        label = row.get("outcome_label")
        if label == 1:
            label_counts["positive"] += 1
        elif label == 0:
            label_counts["negative"] += 1
        else:
            label_counts["unlabeled"] += 1

    null_rates = {field: round(count / total, 4) if total else 0.0 for field, count in null_counts.items()}

    return {
        "totalRows": total,
        "nullRates": null_rates,
        "outOfRangeCounts": out_of_range,
        "duplicateCount": duplicate_count,
        "labelDistribution": label_counts,
        "schemaIssues": schema_issues,
        "healthy": duplicate_count == 0 and not schema_issues and all(v == 0 for v in out_of_range.values()),
    }
