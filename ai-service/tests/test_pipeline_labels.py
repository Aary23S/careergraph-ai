from app.pipelines.labels import derive_label


def test_accepted_is_positive():
    assert derive_label("accepted") == 1


def test_rejected_and_withdrawn_are_negative():
    assert derive_label("rejected") == 0
    assert derive_label("withdrawn") == 0


def test_in_progress_statuses_are_unlabeled():
    for status in ["saved", "not_applied", "applying", "applied", "recruiter_contact", "screening", "interview", "offer"]:
        assert derive_label(status) is None


def test_unrecognized_status_is_unlabeled_not_an_error():
    assert derive_label("some_future_status") is None
    assert derive_label(None) is None
