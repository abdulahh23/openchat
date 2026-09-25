from fastapi.testclient import TestClient

from backend import app

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
