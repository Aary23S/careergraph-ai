"""Phase 4H section 8 -- evaluation metrics, with an explicit guard against
reporting numbers that don't mean anything.

ROC-AUC and PR-AUC are mathematically undefined with only one class present
(scikit-learn raises `ValueError: Only one class present in y_true`) -- which
is exactly today's real situation (0 accepted, 1 withdrawn). Rather than
letting that exception propagate, or padding/faking a class to make the
call succeed, every function here returns an explicit
`{"status": "insufficient_data", ...}` result instead of a metric that would
misrepresent what's actually knowable from the data (section 8: "Do not
report metrics that are statistically meaningless due to insufficient
data").
"""
import numpy as np
from sklearn.metrics import average_precision_score, brier_score_loss, ndcg_score, roc_auc_score

INSUFFICIENT_DATA = "insufficient_data"
DEFAULT_K_VALUES = (1, 3, 5)


def _precision_recall_at_k(y_true, y_scores, k):
    n = len(y_true)
    k = min(k, n)
    if k == 0:
        return None, None
    order = np.argsort(-np.asarray(y_scores, dtype=float))[:k]
    top_labels = np.asarray(y_true)[order]
    total_positive = int(np.sum(y_true))
    precision = round(float(np.sum(top_labels)) / k, 4)
    recall = round(float(np.sum(top_labels)) / total_positive, 4) if total_positive > 0 else None
    return precision, recall


def compute_classification_metrics(y_true, y_scores, k_values=DEFAULT_K_VALUES):
    """Never raises. `y_true`/`y_scores` must be same-length, same-order
    sequences of {0,1} labels and [0,1] scores."""
    y_true = list(y_true)
    y_scores = list(y_scores)
    n = len(y_true)
    positive_count = int(sum(y_true)) if n else 0
    negative_count = n - positive_count

    if n == 0 or positive_count == 0 or negative_count == 0:
        return {
            "status": INSUFFICIENT_DATA,
            "reason": "single_class_or_empty_labels",
            "sampleSize": n,
            "positiveCount": positive_count,
            "negativeCount": negative_count,
        }

    metrics = {
        "status": "computed",
        "sampleSize": n,
        "positiveCount": positive_count,
        "negativeCount": negative_count,
        "positiveRate": round(positive_count / n, 4),
        "rocAuc": round(float(roc_auc_score(y_true, y_scores)), 4),
        "prAuc": round(float(average_precision_score(y_true, y_scores)), 4),
        # Brier score is used here as a simple, always-computable calibration
        # signal (mean squared error between predicted probability and the
        # actual outcome; 0 is perfect, 0.25 is what an uninformed constant
        # 0.5 predictor scores) -- a full reliability-diagram calibration
        # curve needs many more examples per probability bucket than this
        # dataset has to be meaningful, so it is intentionally not computed.
        "brierScore": round(float(brier_score_loss(y_true, y_scores)), 4),
    }

    for k in k_values:
        precision, recall = _precision_recall_at_k(y_true, y_scores, k)
        metrics[f"precisionAt{k}"] = precision
        metrics[f"recallAt{k}"] = recall
        try:
            effective_k = min(k, n)
            metrics[f"ndcgAt{k}"] = round(
                float(ndcg_score(np.asarray([y_true]), np.asarray([y_scores]), k=effective_k)), 4
            )
        except Exception:
            metrics[f"ndcgAt{k}"] = None

    return metrics


def compare_to_baseline(ml_metrics, baseline_metrics):
    """A delta is only meaningful when both sides are real computed numbers
    -- diffing against an insufficient-data placeholder would itself be a
    statistically meaningless metric."""
    if ml_metrics.get("status") != "computed" or baseline_metrics.get("status") != "computed":
        return {"status": INSUFFICIENT_DATA, "reason": "one_or_both_sides_insufficient"}

    return {
        "status": "computed",
        "rocAucDelta": round(ml_metrics["rocAuc"] - baseline_metrics["rocAuc"], 4),
        "prAucDelta": round(ml_metrics["prAuc"] - baseline_metrics["prAuc"], 4),
        "mlBeatsBaselineOnRocAuc": ml_metrics["rocAuc"] > baseline_metrics["rocAuc"],
        "mlBeatsBaselineOnPrAuc": ml_metrics["prAuc"] > baseline_metrics["prAuc"],
    }
