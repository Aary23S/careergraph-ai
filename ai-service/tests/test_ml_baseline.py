from app.ml.training import baseline


class _FakeConnection:
    def close(self):
        pass


def test_fetch_real_baseline_scores_returns_empty_without_touching_db_for_empty_input(monkeypatch):
    def _boom():
        raise AssertionError("get_connection should not be called for an empty job_ids list")

    monkeypatch.setattr(baseline, "get_connection", _boom)
    assert baseline.fetch_real_baseline_scores([]) == {}


def test_fetch_real_baseline_scores_prefers_rule_score(monkeypatch):
    def fake_fetch_all(query, params=None, connection=None):
        assert "job_match_analyses" in query
        return [{"job_id": "job-1", "rule_score": 80}]

    monkeypatch.setattr(baseline, "get_connection", lambda: _FakeConnection())
    monkeypatch.setattr(baseline, "fetch_all", fake_fetch_all)

    scores = baseline.fetch_real_baseline_scores(["job-1"])
    assert scores == {"job-1": 0.8}


def test_fetch_real_baseline_scores_falls_back_to_job_match_score_when_missing(monkeypatch):
    calls = []

    def fake_fetch_all(query, params=None, connection=None):
        calls.append(query)
        if "job_match_analyses" in query:
            return []  # no analysis row for this job
        assert "jobs" in query
        return [{"job_id": "job-2", "match_score": 40}]

    monkeypatch.setattr(baseline, "get_connection", lambda: _FakeConnection())
    monkeypatch.setattr(baseline, "fetch_all", fake_fetch_all)

    scores = baseline.fetch_real_baseline_scores(["job-2"])
    assert scores == {"job-2": 0.4}
    assert len(calls) == 2


def test_fetch_real_baseline_scores_job_with_no_score_anywhere_is_absent(monkeypatch):
    def fake_fetch_all(query, params=None, connection=None):
        return []

    monkeypatch.setattr(baseline, "get_connection", lambda: _FakeConnection())
    monkeypatch.setattr(baseline, "fetch_all", fake_fetch_all)

    scores = baseline.fetch_real_baseline_scores(["job-missing"])
    assert scores == {}


def test_baseline_scores_for_rows_development_mode_reads_dev_field():
    rows = [
        {"application_id": "a1", "_dev_baseline_score": 0.42},
        {"application_id": "a2", "_dev_baseline_score": None},
    ]
    scores = baseline.baseline_scores_for_rows(rows, mode="development")
    assert scores == {"a1": 0.42, "a2": None}


def test_baseline_scores_for_rows_real_mode_maps_by_job_id(monkeypatch):
    monkeypatch.setattr(baseline, "fetch_real_baseline_scores", lambda job_ids, connection=None: {"job-1": 0.7})
    rows = [
        {"application_id": "a1", "job_id": "job-1"},
        {"application_id": "a2", "job_id": "job-unscored"},
    ]
    scores = baseline.baseline_scores_for_rows(rows, mode="real")
    assert scores == {"a1": 0.7, "a2": None}
