"""Phase 4H section 14 -- data-scarcity gate.

`applications.status` (via app.pipelines.labels.derive_label) is the only
real outcome signal in the schema. Before any training happens on a "real"
mode dataset, this module answers one question honestly: is there enough
labeled signal to report a metric that means anything? If not, the pipeline
must return a clear MODEL_NOT_READY state rather than training/promoting a
model that looks real but was fit (or evaluated) on noise.
"""
from app.ml.training.constants import MIN_NEGATIVE_LABELS, MIN_POSITIVE_LABELS, MIN_TOTAL_LABELS

INSUFFICIENT_LABELED_DATA = "insufficient_labeled_data"


def analyze_label_sufficiency(rows, min_positive=MIN_POSITIVE_LABELS, min_negative=MIN_NEGATIVE_LABELS, min_total=MIN_TOTAL_LABELS):
    """`rows` should be the whole dataset (all splits combined) -- this is a
    coarse, dataset-wide gate; per-split readiness for computing a metric on
    that specific split is checked separately in evaluate.py, since a
    dataset can pass this gate overall while one split still ends up
    single-class after a time-based split."""
    positive = sum(1 for r in rows if r.get("outcome_label") == 1)
    negative = sum(1 for r in rows if r.get("outcome_label") == 0)
    total_labeled = positive + negative
    unlabeled = len(rows) - total_labeled

    is_ready = positive >= min_positive and negative >= min_negative and total_labeled >= min_total

    return {
        "isReady": is_ready,
        "positive": positive,
        "negative": negative,
        "labeledTotal": total_labeled,
        "unlabeled": unlabeled,
        "totalRows": len(rows),
        "minimumRequired": {"positive": min_positive, "negative": min_negative, "total": min_total},
        "reason": None if is_ready else INSUFFICIENT_LABELED_DATA,
    }
