import io


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "provider" in data


def test_analyze_returns_bp_reading_shape(client):
    image = io.BytesIO(b"fake-image-bytes")
    response = client.post("/api/analyze", files={"image": ("bp.jpg", image, "image/jpeg")})
    assert response.status_code == 200
    data = response.json()
    assert data["sys"] == 120
    assert data["dia"] == 80
    assert data["pulse"] == 72
    assert data["confidence"] == "high"


def test_analyze_missing_image_returns_422(client):
    response = client.post("/api/analyze")
    assert response.status_code == 422
