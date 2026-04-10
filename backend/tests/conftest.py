import pytest
from fastapi.testclient import TestClient

from main import app
from services.llm_service import BPReading, LLMProvider


class MockProvider(LLMProvider):
    async def analyze_bp_image(self, image_bytes: bytes, media_type: str) -> BPReading:
        return BPReading(sys=120, dia=80, pulse=72, confidence="high")


@pytest.fixture
def client():
    with TestClient(app) as c:
        app.state.provider = MockProvider()
        yield c
