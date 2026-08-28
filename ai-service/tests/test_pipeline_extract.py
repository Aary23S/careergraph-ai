from app.pipelines import extract


def test_fetch_connections_for_users_groups_by_user(monkeypatch):
    monkeypatch.setattr(
        extract,
        "fetch_all",
        lambda query, params=None, connection=None: [
            {"user_id": "u1", "normalized_company": "acme", "relationship_strength": "strong", "priority": "high"},
            {"user_id": "u1", "normalized_company": "other", "relationship_strength": "weak", "priority": "low"},
            {"user_id": "u2", "normalized_company": "acme", "relationship_strength": "medium", "priority": "medium"},
        ],
    )
    result = extract.fetch_connections_for_users(["u1", "u2"])
    assert len(result["u1"]) == 2
    assert len(result["u2"]) == 1


def test_fetch_connections_for_users_empty_input_short_circuits(monkeypatch):
    called = []
    monkeypatch.setattr(extract, "fetch_all", lambda *a, **k: called.append(1) or [])
    result = extract.fetch_connections_for_users([])
    assert result == {}
    assert called == []  # never even queries


def test_fetch_embeddings_keys_by_type_and_id(monkeypatch):
    monkeypatch.setattr(
        extract,
        "fetch_all",
        lambda query, params=None, connection=None: [
            {"entity_type": "job", "entity_id": "job-1", "embedding": [0.1], "embedding_model": "m1"},
            {"entity_type": "resume", "entity_id": "resume-1", "embedding": [0.2], "embedding_model": "m1"},
        ],
    )
    result = extract.fetch_embeddings([("job", "job-1"), ("resume", "resume-1")])
    assert result[("job", "job-1")]["embedding_model"] == "m1"
    assert result[("resume", "resume-1")]["embedding"] == [0.2]


def test_fetch_embeddings_first_row_wins_on_duplicate_key(monkeypatch):
    """Query orders by updated_at DESC, so the first row seen per key is the
    most recent -- this must not be overwritten by an older duplicate."""
    monkeypatch.setattr(
        extract,
        "fetch_all",
        lambda query, params=None, connection=None: [
            {"entity_type": "job", "entity_id": "job-1", "embedding": [0.9], "embedding_model": "newest"},
            {"entity_type": "job", "entity_id": "job-1", "embedding": [0.1], "embedding_model": "oldest"},
        ],
    )
    result = extract.fetch_embeddings([("job", "job-1")])
    assert result[("job", "job-1")]["embedding_model"] == "newest"


def test_fetch_embeddings_empty_input_short_circuits(monkeypatch):
    called = []
    monkeypatch.setattr(extract, "fetch_all", lambda *a, **k: called.append(1) or [])
    assert extract.fetch_embeddings([]) == {}
    assert called == []
