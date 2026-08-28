"""Phase 4G -- time-based train/validation/test splitting (section 8).

Splitting by `prediction_time` (application creation time) rather than
randomly prevents test-set leakage: a random split could put an
application from last week in "train" and one from a year ago in "test",
letting the model implicitly learn from the future relative to what it's
being tested on. Sorting by time and cutting the most recent slice into
test (then validation) guarantees every training row genuinely precedes
every test row in time.
"""

DEFAULT_TRAIN_FRACTION = 0.7
DEFAULT_VALIDATION_FRACTION = 0.15
# test fraction is whatever remains


def time_based_split(rows, train_fraction=DEFAULT_TRAIN_FRACTION, validation_fraction=DEFAULT_VALIDATION_FRACTION):
    """Returns `(splits, cutoffs)`:
      splits = {"train": [...], "validation": [...], "test": [...]}
      cutoffs = {"train_end": ts, "validation_end": ts} (both None if there
        are too few rows to produce a meaningful cutoff, e.g. an empty
        dataset) -- recorded in dataset metadata per section 8's "Document
        split timestamps."
    Rows must each have a `prediction_time` field; order of the input list
    does not matter, this function sorts internally.
    """
    if not rows:
        return {"train": [], "validation": [], "test": []}, {"train_end": None, "validation_end": None}

    ordered = sorted(rows, key=lambda r: (r["prediction_time"], r.get("application_id") or ""))
    n = len(ordered)
    train_end_idx = int(n * train_fraction)
    validation_end_idx = int(n * (train_fraction + validation_fraction))

    # Guarantee no split is silently starved to zero rows purely by integer
    # truncation when there's more than one row per intended split.
    train_end_idx = max(train_end_idx, 1) if n >= 1 else 0
    validation_end_idx = max(validation_end_idx, train_end_idx)

    train_rows = ordered[:train_end_idx]
    validation_rows = ordered[train_end_idx:validation_end_idx]
    test_rows = ordered[validation_end_idx:]

    cutoffs = {
        "train_end": train_rows[-1]["prediction_time"] if train_rows else None,
        "validation_end": validation_rows[-1]["prediction_time"] if validation_rows else (train_rows[-1]["prediction_time"] if train_rows else None),
    }
    return {"train": train_rows, "validation": validation_rows, "test": test_rows}, cutoffs
