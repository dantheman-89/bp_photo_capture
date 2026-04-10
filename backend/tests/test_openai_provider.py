from pathlib import Path

import pytest

from config import settings
from services.llm_service import OpenAIProvider

FIXTURE_DIR = Path(__file__).parent / "fixture"

pytestmark = pytest.mark.skipif(
    not settings.openai_api_key,
    reason="OPENAI_API_KEY not set",
)


@pytest.fixture
def provider():
    return OpenAIProvider(api_key=settings.openai_api_key)


@pytest.mark.anyio
async def test_bp_monitor_image(provider):
    image_bytes = (FIXTURE_DIR / "bp_monitor.jpg").read_bytes()
    reading = await provider.analyze_bp_image(image_bytes, "image/jpeg")

    print(f"\nOpenAI response: {reading}")

    assert reading.confidence in ("high", "low")
    assert reading.sys == 120
    assert reading.dia == 70
    assert reading.pulse == 60


@pytest.mark.anyio
async def test_non_bp_image(provider):
    image_bytes = (FIXTURE_DIR / "not_bp.jpg").read_bytes()
    reading = await provider.analyze_bp_image(image_bytes, "image/jpeg")

    print(f"\nOpenAI response: {reading}")

    assert reading.confidence == "failed"
    assert reading.sys == 0
    assert reading.dia == 0
    assert reading.pulse == 0
    assert reading.message is not None
    assert len(reading.message) > 0
