from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from services.llm_service import AnthropicProvider, BPReading, LLMProvider, OpenAIProvider


@asynccontextmanager
async def lifespan(app: FastAPI):
    provider: LLMProvider
    if settings.active_provider == "openai":
        provider = OpenAIProvider(api_key=settings.openai_api_key)
    elif settings.active_provider == "anthropic":
        provider = AnthropicProvider(api_key=settings.anthropic_api_key)
    else:
        raise ValueError(f"Unknown active_provider: {settings.active_provider!r}")
    app.state.provider = provider
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app.get("/health")
async def health():
    return {"status": "ok", "provider": settings.active_provider}


@app.post("/api/analyze", response_model=BPReading)
async def analyze(request: Request, image: UploadFile = File(...)):
    image_bytes = await image.read()
    provider: LLMProvider = request.app.state.provider
    return await provider.analyze_bp_image(image_bytes, image.content_type)
