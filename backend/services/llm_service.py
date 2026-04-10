import base64
import json
from abc import ABC, abstractmethod
from typing import Literal

from openai import AsyncOpenAI
from pydantic import BaseModel


class BPReading(BaseModel):
    sys: int
    dia: int
    pulse: int
    confidence: Literal["high", "low", "failed"]
    message: str | None = None
    raw_response: str | None = None


class LLMProvider(ABC):
    @abstractmethod
    async def analyze_bp_image(self, image_bytes: bytes, media_type: str) -> BPReading:
        ...


_PROMPT = """\
You are a blood pressure reading extraction assistant.

Your job is to examine the image and extract SYS (systolic), DIA (diastolic), \
and Pulse values from a blood pressure monitor display.

FIRST, determine if the image shows a blood pressure monitor:
- If it clearly does not (e.g. a person, food, landscape, text document, \
  random object), set confidence to "failed" and explain in the message field.
- If the image is too blurry, dark, or out of focus to read, set confidence \
  to "failed" and explain.
- If the monitor display is partially cut off or obstructed, set confidence \
  to "low" or "failed" depending on how much is visible.
- If all three values are clearly visible and legible, set confidence to "high".
- If values are visible but you are uncertain about one or more digits, \
  set confidence to "low".

Respond with ONLY valid JSON — no markdown, no explanation, no code fences. \
Use this exact shape:
{"sys": <int>, "dia": <int>, "pulse": <int>, "confidence": "high"|"low"|"failed", "message": "<str or null>"}

For "failed" readings, set sys/dia/pulse to 0 and put a short, \
user-friendly explanation in message (e.g. "This does not appear to be a \
blood pressure monitor.", "The display is too blurry to read.", \
"The monitor screen is not visible in this photo.").
For "high" or "low" confidence readings, message may be null or a brief note.
"""


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str) -> None:
        self.client = AsyncOpenAI(api_key=api_key)

    async def analyze_bp_image(self, image_bytes: bytes, media_type: str) -> BPReading:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        response = await self.client.responses.create(
            model="gpt-5.4-mini",
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": _PROMPT},
                        {
                            "type": "input_image",
                            "image_url": f"data:{media_type};base64,{b64}",
                        },
                    ],
                }
            ],
            max_output_tokens=128,
        )
        raw_text = response.output_text or ""
        try:
            data = json.loads(raw_text)
            return BPReading(**data)
        except Exception:
            return BPReading(
                sys=0,
                dia=0,
                pulse=0,
                confidence="failed",
                message="Unexpected response from the model.",
                raw_response=raw_text,
            )


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def analyze_bp_image(self, image_bytes: bytes, media_type: str) -> BPReading:
        raise NotImplementedError("AnthropicProvider not yet implemented")
