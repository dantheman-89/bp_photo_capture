# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`bp_photo_capture` is a mobile-first web app for feasibility testing: photograph a blood pressure monitor and extract SYS / DIA / Pulse using a multimodal LLM. This is a personal feasibility MVP — not production, no login, no auth.

- Frontend sends photo to backend; backend calls the LLM vendor SDK using server-side API keys
- Never expose API keys to the browser

## Repo Structure

```
bp_photo_capture/        ← repo root
├── backend/             ← Python / FastAPI
├── frontend/            ← React + Vite + Tailwind CSS
└── infra/               ← deployment config
```

Each subdirectory manages its own environment. The root is not a Python or Node package.

## Deployment

Single container: Vite builds static assets into `frontend/dist/`, FastAPI serves both the API and those static files.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Config | pydantic-settings + `.env` |
| File uploads | python-multipart |
| LLM (default) | OpenAI gpt-4.5-mini via `openai` SDK |
| Testing | pytest, pytest-anyio |
| Package mgr (backend) | uv |
| Package mgr (frontend) | npm |

Do not use `httpx` for LLM calls — they go through vendor SDKs. `httpx` is a dev dependency only, required by `TestClient`. Do not use WebSocket — request/response is correct for this use case.

---

## Backend

All backend commands run from `backend/`.

### File structure

```
backend/
├── main.py
├── config.py
├── .env.example
├── services/
│   └── llm_service.py
└── tests/
    ├── conftest.py
    ├── test_analyze.py
    ├── test_openai_provider.py
    └── fixture/
        ├── bp_monitor.jpg
        └── not_bp.jpg
```

### Daily commands

```bash
cd backend

uv sync --dev                                                           # install / sync all deps
uv run uvicorn main:app --reload                                        # dev server
uv run pytest tests/test_analyze.py                                     # fast mock-based tests (no API key needed)
uv run pytest tests/test_openai_provider.py -v -s                      # real OpenAI integration tests
uv run pytest tests/test_analyze.py::test_function_name                 # single test
uv add <package>                                                        # runtime dep
uv add --dev <package>                                                  # dev dep
```

### Setup (first time)

```bash
cd backend
uv init --python 3.11 --name bp-photo-capture-backend
uv add fastapi uvicorn python-multipart pydantic-settings openai
uv add --dev pytest httpx anyio pytest-anyio
uv lock
uv sync
# Tighten pyproject.toml: requires-python = ">=3.11,<3.12"
# Add to pyproject.toml:
# [tool.pytest.ini_options]
# pythonpath = ["."]
# anyio_mode = "auto"
```

Python 3.11 is pinned via `.python-version` and `requires-python = ">=3.11,<3.12"` in `pyproject.toml`. Both are intentional.

### Configuration (config.py)

Pydantic Settings class reading from `.env`:

```python
class Settings(BaseSettings):
    openai_api_key: str
    anthropic_api_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173"]
    active_provider: str = "openai"

    model_config = SettingsConfigDict(env_file=".env")
```

Copy `.env.example` to `.env` and fill in values. Never commit `.env`.

### API endpoints (main.py)

No `routers/` folder — endpoints are defined directly on `app` in `main.py`.

- `POST /api/analyze` — accepts multipart image upload, returns `BPReading` JSON
- `GET /health` — returns `{"status": "ok", "provider": "<active provider name>"}`

### Provider wiring (main.py)

On startup, `main.py` reads `settings.active_provider` and instantiates the correct provider, storing it on `app.state.provider`. Endpoints access it via `request.app.state.provider`. No other file imports from `main.py`.

### LLM service (services/llm_service.py)

All three things live in one file: the ABC definition, all provider implementations, and the `BPReading` model.

**BPReading model:**
```python
class BPReading(BaseModel):
    sys: int
    dia: int
    pulse: int
    confidence: Literal["high", "low", "failed"]
    message: str | None = None
    raw_response: str | None = None
```

**LLMProvider ABC** — one abstract method:
```python
async def analyze_bp_image(self, image_bytes: bytes, media_type: str) -> BPReading: ...
```

**Providers:**
- `OpenAIProvider(LLMProvider)` — default, uses `gpt-5.4-mini`, `AsyncOpenAI` client instantiated once in `__init__` and reused across requests
- `AnthropicProvider(LLMProvider)` — stub only, raises `NotImplementedError`

Provider is selected by `active_provider` in `.env` (default: `"openai"`).

### Testing

Two separate test files by design — they test at different levels and have different runtime costs:

- `tests/conftest.py` — `MockProvider` returning a fixed `BPReading`; `TestClient` fixture that overrides `app.state.provider` after lifespan completes
- `tests/test_analyze.py` — endpoint shape tests using `MockProvider`; no real API calls; always runs in CI
- `tests/test_openai_provider.py` — real OpenAI API calls using fixture photos; skipped automatically if `OPENAI_API_KEY` is not set; run with `-s` to see printed output
- `tests/fixture/` — two reference photos: `bp_monitor.jpg` (expected sys=120, dia=70, pulse=60) and `not_bp.jpg` (expected confidence=failed)

---

## Frontend

All frontend commands run from `frontend/`.

### Daily commands

```bash
cd frontend
npm install        # install deps (e.g. after pulling changes)
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # build static assets into frontend/dist/
npm run preview    # preview production build locally
```

### File structure

```
frontend/
├── index.html
├── vite.config.js
├── package.json
├── package-lock.json
└── src/
    ├── main.jsx               ← React entry point, mounts App into index.html
    ├── index.css              ← single @import "tailwindcss" line
    ├── App.jsx                ← owns all app state and the fetch call
    └── components/
        ├── CameraView.jsx     ← camera preview + capture button
        └── ResultPanel.jsx    ← displays readings / spinner / errors / manual entry
```

### Setup (first time, Windows)

Node version management uses **nvm-windows**. Install it from:
`https://github.com/coreybutler/nvm-windows/releases` (download `nvm-setup.exe`)

```powershell
# After installing nvm-windows, open a new PowerShell window:
nvm install lts
nvm use lts

# Scaffold (run from repo root, not frontend/):
npm create vite@latest frontend -- --template react

cd frontend
npm install
npm install -D @tailwindcss/vite   # Tailwind v4 — no postcss config or tailwind.config.js needed
```

**Tailwind v4 wiring (already done — do not re-run):**
- `vite.config.js` — import and add `tailwindcss()` from `@tailwindcss/vite` to `plugins`
- `src/index.css` — contains only `@import "tailwindcss";`
- No `tailwind.config.js`, no `postcss.config.js`

### Vite proxy (dev only)

Vite dev server runs on port 5173, FastAPI on port 8000. Configured in `vite.config.js`:

```js
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

In dev, any `fetch('/api/...')` call from React is forwarded to FastAPI. In production this is not needed — FastAPI serves everything.

### package.json and package-lock.json

- `package.json` — dependencies and scripts; analogous to `pyproject.toml`
- `package-lock.json` — exact locked tree; analogous to `uv.lock`. Commit both.
- `node_modules/` — do not commit

### Frontend UX states

1. **Initial** — live camera preview, "Take photo" button, empty result panel
2. **Processing** — frozen captured image, loading indicator in result panel
3. **Success** — SYS / DIA / Pulse displayed, Retake + Submit buttons
4. **Low confidence** — prompt user to retake
5. **Repeated failure (3×)** — allow manual entry

Only show controls relevant to the current state. Layout: top ~2/3 camera/image, bottom ~1/3 result panel.

---

## General principles

- Abstraction must earn its complexity — no unnecessary nesting or folders
- Add structure when the code demands it, not before
- Do not use WebSocket
- API keys live only in `.env`, never in code or committed files
