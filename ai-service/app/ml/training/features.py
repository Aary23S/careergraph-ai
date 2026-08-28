"""Phase 4H -- turns published dataset rows into the exact feature frame the
model is trained/scored on. This is the one chokepoint through which row
data must pass before it reaches scikit-learn, which is also what makes it
the right place to enforce the leakage boundary: only FEATURE_COLUMNS ever
crosses this function, regardless of what extra fields a row happens to
carry (identifiers, timestamps, the label itself).
"""
import numpy as np
import pandas as pd

from app.ml.training.constants import CATEGORICAL_FEATURES, EXCLUDED_FROM_FEATURES, FEATURE_COLUMNS, NUMERIC_FEATURES

assert not (set(FEATURE_COLUMNS) & EXCLUDED_FROM_FEATURES), (
    "A leakage-sensitive field is present in FEATURE_COLUMNS -- see constants.py. "
    "This assertion is the first line of defense; test_ml_leakage.py verifies it too."
)

# Categorical imputation uses an explicit sentinel string rather than leaving
# None in the frame -- OneHotEncoder(handle_unknown='ignore') treats a
# consistent sentinel as just another (frequently-missing) category, which is
# both simpler and more transparent than silently dropping missing rows.
MISSING_CATEGORY = "__missing__"


def filter_labeled(rows):
    """Only rows with a resolved outcome (0 or 1) -- unlabeled rows
    (`outcome_label is None`) are valid feature examples for future scoring
    but must never be used to fit or score against during training/eval,
    since there's nothing to compare against."""
    return [r for r in rows if r.get("outcome_label") in (0, 1)]


def extract_labels(rows):
    return [int(r["outcome_label"]) for r in rows]


def to_frame(rows):
    """Builds a pandas DataFrame containing ONLY FEATURE_COLUMNS, in a fixed
    column order, regardless of what other keys `rows` carry. Missing
    numeric values become NaN (for SimpleImputer); missing categorical
    values become MISSING_CATEGORY (for OneHotEncoder)."""
    records = []
    for row in rows:
        record = {}
        for col in NUMERIC_FEATURES:
            value = row.get(col)
            record[col] = np.nan if value is None else float(value)
        for col in CATEGORICAL_FEATURES:
            value = row.get(col)
            record[col] = MISSING_CATEGORY if value is None else str(value)
        records.append(record)
    return pd.DataFrame.from_records(records, columns=FEATURE_COLUMNS)
