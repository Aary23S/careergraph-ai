def test_embedding_single_string(client):
    response = client.post("/v1/embeddings", json={"input": "hello world"})
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["embedding"], list)
    assert all(isinstance(v, float) for v in body["embedding"])
    assert body["dimension"] == len(body["embedding"])
    assert body["model"]


def test_embedding_batch_input(client):
    response = client.post("/v1/embeddings", json={"input": ["a", "b", "c"]})
    assert response.status_code == 200
    body = response.json()
    assert len(body["embedding"]) == 3
    assert all(len(vec) == body["dimension"] for vec in body["embedding"])


def test_embedding_is_deterministic_for_same_text(client):
    r1 = client.post("/v1/embeddings", json={"input": "same text"})
    r2 = client.post("/v1/embeddings", json={"input": "same text"})
    assert r1.json()["embedding"] == r2.json()["embedding"]


def test_embedding_rejects_empty_string(client):
    response = client.post("/v1/embeddings", json={"input": ""})
    assert response.status_code == 422


def test_embedding_rejects_empty_list(client):
    response = client.post("/v1/embeddings", json={"input": []})
    assert response.status_code == 422


def test_embedding_rejects_missing_input(client):
    response = client.post("/v1/embeddings", json={})
    assert response.status_code == 422


def test_embedding_model_unavailable_returns_503(client, monkeypatch):
    from app.api import embeddings as embeddings_route

    def boom(*_args, **_kwargs):
        raise RuntimeError("model load failed")

    monkeypatch.setattr(embeddings_route, "generate_embeddings", boom)

    response = client.post("/v1/embeddings", json={"input": "hello"})
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()


def test_embedding_timeout_like_failure_returns_503(client, monkeypatch):
    from app.api import embeddings as embeddings_route

    def boom(*_args, **_kwargs):
        raise TimeoutError("model inference timed out")

    monkeypatch.setattr(embeddings_route, "generate_embeddings", boom)

    response = client.post("/v1/embeddings", json={"input": "hello"})
    assert response.status_code == 503
    assert "timed out" in response.json()["detail"].lower()
