def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "careergraph-ai-service"
    assert "version" in body


def test_health_exposes_no_secrets(client):
    response = client.get("/health")
    body_text = str(response.json()).lower()
    for forbidden in ("key", "secret", "token", "password"):
        assert forbidden not in body_text
