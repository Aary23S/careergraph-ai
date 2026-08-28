from app.ml.training.label_check import INSUFFICIENT_LABELED_DATA, analyze_label_sufficiency


def _rows(positive=0, negative=0, unlabeled=0):
    return (
        [{"outcome_label": 1}] * positive
        + [{"outcome_label": 0}] * negative
        + [{"outcome_label": None}] * unlabeled
    )


def test_todays_real_careergraph_dataset_is_not_ready():
    """Regression test pinned to the real, live-verified counts as of
    Phase 4H (see docs/opportunity-ranking.md): 0 accepted, 1 withdrawn,
    7 in-progress, out of 8 total applications."""
    rows = _rows(positive=0, negative=1, unlabeled=7)
    result = analyze_label_sufficiency(rows)
    assert result["isReady"] is False
    assert result["reason"] == INSUFFICIENT_LABELED_DATA
    assert result["positive"] == 0
    assert result["negative"] == 1
    assert result["unlabeled"] == 7
    assert result["totalRows"] == 8


def test_below_minimum_positive_is_not_ready():
    rows = _rows(positive=5, negative=20, unlabeled=0)
    result = analyze_label_sufficiency(rows, min_positive=10, min_negative=10, min_total=40)
    assert result["isReady"] is False


def test_below_minimum_total_is_not_ready_even_if_each_class_individually_clears():
    rows = _rows(positive=10, negative=10, unlabeled=0)  # total 20 < min_total 40
    result = analyze_label_sufficiency(rows, min_positive=10, min_negative=10, min_total=40)
    assert result["isReady"] is False


def test_meeting_all_three_thresholds_is_ready():
    rows = _rows(positive=15, negative=25, unlabeled=5)
    result = analyze_label_sufficiency(rows, min_positive=10, min_negative=10, min_total=40)
    assert result["isReady"] is True
    assert result["reason"] is None


def test_minimum_required_is_echoed_back_for_the_caller_to_display():
    result = analyze_label_sufficiency([], min_positive=3, min_negative=4, min_total=5)
    assert result["minimumRequired"] == {"positive": 3, "negative": 4, "total": 5}
