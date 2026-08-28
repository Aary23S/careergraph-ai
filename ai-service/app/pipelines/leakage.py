"""Phase 4G -- temporal leakage protection (section 6).

Prediction time for a row is `applications.created_at` -- the point we're
simulating a ranking/prediction decision at. Any joined AI-enrichment or
embedding record is only a valid feature input if it existed at or before
that moment; if it was created later, using it would leak information from
the future into a feature meant to represent "what we knew at the time."

Two layers, matching "create automated checks":
  1. `mask_if_future` -- applied per-field during feature construction
     (transform.py), so a late-arriving enrichment silently becomes a
     missing feature (None) rather than a leaked one.
  2. `check_no_leakage` -- a defense-in-depth re-scan of the finished
     dataset's carried source timestamps, independent of whether masking
     was actually applied correctly. Raises LeakageError if anything slipped
     through. Called by the pipeline before publish; also directly
     unit-tested against deliberately-broken input.
"""


def mask_if_future(value, source_timestamp, prediction_time):
    """Returns `value` unchanged if there's nothing to check (missing value
    or missing timestamps) or if `source_timestamp <= prediction_time`.
    Returns None if `source_timestamp` is after `prediction_time`."""
    if value is None or source_timestamp is None or prediction_time is None:
        return value
    if source_timestamp > prediction_time:
        return None
    return value


class LeakageError(RuntimeError):
    pass


def check_no_leakage(rows, timestamp_fields, prediction_time_field="prediction_time"):
    """`rows` must each be a dict carrying `prediction_time_field` plus the
    raw source timestamps named in `timestamp_fields` (this audit data is
    stripped before the dataset is published -- see publish.py). Returns
    True if clean; raises LeakageError (naming the offending rows) otherwise."""
    violations = []
    for row in rows:
        prediction_time = row.get(prediction_time_field)
        if prediction_time is None:
            continue
        for field in timestamp_fields:
            source_ts = row.get(field)
            if source_ts is not None and source_ts > prediction_time:
                violations.append({"application_id": row.get("application_id"), "field": field})
    if violations:
        raise LeakageError(
            f"{len(violations)} row(s) carry a feature-source timestamp after their prediction_time: "
            f"{violations[:5]}{'...' if len(violations) > 5 else ''}"
        )
    return True
