from fastapi.testclient import TestClient

import app.main as main


def test_ai_routes_require_configured_internal_token(monkeypatch):
    monkeypatch.delenv("HEXAWAVE_ENV", raising=False)
    monkeypatch.delenv("NODE_ENV", raising=False)
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.setenv("HEXAWAVE_AI_SERVICE_TOKEN", "test-internal-token")
    client = TestClient(main.app)

    assert client.get("/health").status_code == 200
    assert client.get("/projects").status_code == 401
    assert client.get(
        "/projects",
        headers={"X-Hexawave-Service-Token": "wrong-token"},
    ).status_code == 401
    assert client.get(
        "/projects",
        headers={"X-Hexawave-Service-Token": "test-internal-token"},
    ).status_code == 200


def test_ai_routes_fail_closed_in_production_without_token(monkeypatch):
    monkeypatch.setenv("HEXAWAVE_ENV", "production")
    monkeypatch.delenv("HEXAWAVE_AI_SERVICE_TOKEN", raising=False)
    client = TestClient(main.app)

    assert client.get("/health").status_code == 200
    response = client.get("/projects")
    assert response.status_code == 503
    assert response.json()["detail"] == (
        "AI service authentication is not configured."
    )


def test_production_build_and_run_routes_require_sandbox(monkeypatch):
    monkeypatch.setenv("HEXAWAVE_ENV", "production")
    monkeypatch.setenv("HEXAWAVE_AI_SERVICE_TOKEN", "test-internal-token")
    client = TestClient(main.app)
    headers = {"X-Hexawave-Service-Token": "test-internal-token"}
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"

    for action in ("build", "run"):
        response = client.post(
            f"/projects/{project_id}/{action}",
            headers=headers,
        )
        assert response.status_code == 503
        assert "sandbox" in response.json()["detail"]
