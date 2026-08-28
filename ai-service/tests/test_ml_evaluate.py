from app.ml.training.evaluate import compare_to_baseline, compute_classification_metrics


def test_single_class_labels_return_insufficient_data_not_a_crash():
    result = compute_classification_metrics([0, 0, 0], [0.2, 0.5, 0.8])
    assert result["status"] == "insufficient_data"
    assert result["reason"] == "single_class_or_empty_labels"


def test_empty_labels_return_insufficient_data():
    result = compute_classification_metrics([], [])
    assert result["status"] == "insufficient_data"


def test_todays_real_scenario_zero_positives_one_negative_is_insufficient():
    """Regression test for CareerGraph's actual current label distribution
    (0 accepted, 1 withdrawn) -- must never silently produce a metric."""
    result = compute_classification_metrics([0], [0.4])
    assert result["status"] == "insufficient_data"


def test_well_separated_scores_produce_high_roc_auc():
    y_true = [0, 0, 0, 0, 1, 1, 1, 1]
    y_scores = [0.1, 0.2, 0.15, 0.05, 0.9, 0.95, 0.8, 0.85]
    result = compute_classification_metrics(y_true, y_scores)
    assert result["status"] == "computed"
    assert result["rocAuc"] > 0.95
    assert result["prAuc"] > 0.9


def test_precision_and_recall_at_k_on_a_known_example():
    # Top 2 scores (0.9, 0.8) both belong to positives -> precision@2 = 1.0
    y_true = [1, 0, 1, 0]
    y_scores = [0.9, 0.3, 0.8, 0.1]
    result = compute_classification_metrics(y_true, y_scores, k_values=(2,))
    assert result["precisionAt2"] == 1.0
    assert result["recallAt2"] == 1.0


def test_k_larger_than_sample_size_is_capped_not_an_error():
    y_true = [1, 0]
    y_scores = [0.9, 0.1]
    result = compute_classification_metrics(y_true, y_scores, k_values=(10,))
    assert result["precisionAt10"] is not None


def test_compare_to_baseline_insufficient_when_either_side_insufficient():
    ml = compute_classification_metrics([1, 0, 1, 0], [0.9, 0.1, 0.8, 0.2])
    insufficient = compute_classification_metrics([0], [0.5])
    assert compare_to_baseline(ml, insufficient)["status"] == "insufficient_data"
    assert compare_to_baseline(insufficient, ml)["status"] == "insufficient_data"


def test_compare_to_baseline_reports_deltas_when_both_computed():
    # ml's score order matches the labels perfectly (positives ranked
    # first); baseline's is inverted (positives ranked last) -- a real,
    # unambiguous difference in ranking quality, not just magnitude.
    ml = compute_classification_metrics([1, 0, 1, 0], [0.95, 0.05, 0.9, 0.1])
    baseline = compute_classification_metrics([1, 0, 1, 0], [0.3, 0.7, 0.4, 0.6])
    comparison = compare_to_baseline(ml, baseline)
    assert comparison["status"] == "computed"
    assert comparison["mlBeatsBaselineOnRocAuc"] is True
    assert comparison["rocAucDelta"] > 0
