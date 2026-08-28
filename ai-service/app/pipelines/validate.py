"""Phase 4G -- validation stage: runs on RAW extracted rows before
transform/feature-engineering. Invalid rows are quarantined (excluded, with
a reason recorded) rather than silently dropped or allowed to corrupt the
dataset (section 9: "Reject or quarantine invalid rows. Do not silently
corrupt the dataset.").
"""
from app.pipelines.labels import NEGATIVE_STATUSES, POSITIVE_STATUSES

KNOWN_APPLICATION_STATUSES = frozenset(
    {
        "saved", "not_applied", "applying", "applied", "recruiter_contact",
        "screening", "interview", "offer", "accepted", "rejected", "withdrawn",
    }
) | POSITIVE_STATUSES | NEGATIVE_STATUSES

REQUIRED_FIELDS = ["application_id", "user_id", "job_id", "company_id", "application_created_at"]


def validate_batch(raw_rows, seen_application_ids):
    """Returns (valid_rows, quarantined). `seen_application_ids` is a set
    threaded across batches by the caller so duplicates are caught even
    when they land in different batches (keyset pagination guarantees no
    row appears in more than one batch, but this guards against the query
    itself ever being changed to allow it). Mutates `seen_application_ids`."""
    valid_rows = []
    quarantined = []

    for row in raw_rows:
        reasons = []

        for field in REQUIRED_FIELDS:
            if row.get(field) is None:
                reasons.append(f"missing_required_field:{field}")

        application_id = row.get("application_id")
        if application_id is not None and application_id in seen_application_ids:
            reasons.append("duplicate_application_id")

        status = row.get("application_status")
        if status is not None and status not in KNOWN_APPLICATION_STATUSES:
            reasons.append(f"unknown_application_status:{status}")

        if reasons:
            quarantined.append({"application_id": application_id, "reasons": reasons})
            continue

        seen_application_ids.add(application_id)
        valid_rows.append(row)

    return valid_rows, quarantined
