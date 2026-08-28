def test_rerank_returns_all_candidates_sorted_desc(client):
    response = client.post(
        "/v1/rerank",
        json={
            "query": "python developer",
            "candidates": [
                {"id": "a", "text": "senior python backend engineer"},
                {"id": "b", "text": "graphic designer with photoshop skills"},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) == 2
    assert {r["id"] for r in body["results"]} == {"a", "b"}
    assert body["results"][0]["score"] >= body["results"][1]["score"]
    assert body["model"]


def test_rerank_rejects_empty_query(client):
    response = client.post(
        "/v1/rerank", json={"query": "", "candidates": [{"id": "a", "text": "x"}]}
    )
    assert response.status_code == 422


def test_rerank_rejects_empty_candidates(client):
    response = client.post("/v1/rerank", json={"query": "x", "candidates": []})
    assert response.status_code == 422


def test_rerank_model_unavailable_returns_503(client, monkeypatch):
    from app.api import rerank as rerank_route

    def boom(*_args, **_kwargs):
        raise RuntimeError("model load failed")

    monkeypatch.setattr(rerank_route, "rerank_candidates", boom)

    response = client.post(
        "/v1/rerank", json={"query": "x", "candidates": [{"id": "a", "text": "y"}]}
    )
    assert response.status_code == 503
