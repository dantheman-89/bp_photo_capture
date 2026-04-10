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
├── Dockerfile           ← multi-stage build (Node → Python)
└── .dockerignore
```

Each subdirectory manages its own environment. The root is not a Python or Node package.

## Deployment

Single container: Vite builds static assets into `frontend/dist/`, FastAPI serves both the API and those static files.

- `Dockerfile` lives at repo root — standard placement for monorepos
- Stage 1 (Node): runs `npm run build`, produces `frontend/dist/`
- Stage 2 (Python): installs backend deps via uv, copies `dist/` from Stage 1
- `frontend/dist/` is git-ignored — always built inside Docker, never committed
- Deployed on Render as a Docker web service; set `OPENAI_API_KEY` as an env var in Render dashboard

### Local Docker test

```bash
docker build -t bp-monitor .
docker run -p 8000:8000 -e OPENAI_API_KEY=your_key bp-monitor
# visit http://localhost:8000
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS v4 |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Config | pydantic-settings + `.env` |
| File uploads | python-multipart |
| LLM (default) | OpenAI via `openai` SDK |
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
    cors_origins: list[str] = ["http://localhost:5173"]  # override via CORS_ORIGINS in prod
    active_provider: str = "openai"

    model_config = SettingsConfigDict(env_file=".env")
```

Copy `.env.example` to `.env` and fill in values. Never commit `.env`.

In production, CORS is not triggered (same-origin requests). The default value is safe to leave as-is for a single-container deploy.

### API endpoints (main.py)

No `routers/` folder — endpoints are defined directly on `app` in `main.py`.

- `POST /api/analyze` — accepts multipart image upload, returns `BPReading` JSON
- `GET /health` — returns `{"status": "ok", "provider": "<active provider name>"}`

Static files are mounted at `/` after all API routes, only when `frontend/dist/` exists.

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
- `OpenAIProvider(LLMProvider)` — default, `AsyncOpenAI` client instantiated once in `__init__` and reused across requests
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
    ├── index.css              ← single @import "tailwindcss" line + custom CSS classes
    ├── App.jsx                ← owns all app state and the fetch call
    └── components/
        ├── CameraView.jsx     ← camera preview + capture + flip button
        └── ResultPanel.jsx    ← displays readings / spinner / errors
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
- `src/index.css` — contains `@import "tailwindcss"` plus custom classes (`btn-brand`, `btn-ghost`, `stat-value`, `panel-card`)
- No `tailwind.config.js`, no `postcss.config.js`

### Vite proxy (dev only)

Vite dev server runs on port 5173, FastAPI on port 8000. Configured in `vite.config.js`:

```js
server: {
  host: true,  // reachable from other devices on the same WiFi
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
- `dist/` — do not commit; always built inside Docker

### Frontend UX states

The app has 6 states managed in `App.jsx`:

| State | Trigger | UI |
|---|---|---|
| `idle` | Initial / after retake | Live camera, shutter + flip buttons |
| `processing` | Photo taken | Frozen image, spinner |
| `success` | `confidence === 'high'` | SYS / DIA / Pulse readings, "Take another" |
| `low` | `confidence !== 'high'`, under 10 attempts | Warning message, attempt counter, retry |
| `network_err` | 502/503/504 or fetch TypeError | Connection error message, retry |
| `exhausted` | 10 consecutive non-high results | Contact customer service message, no retry |

- Fail count resets to 0 on a successful reading
- Network errors do not increment the fail count
- No manual entry — users must contact support after exhausting attempts

---

## General principles

- Abstraction must earn its complexity — no unnecessary nesting or folders
- Add structure when the code demands it, not before
- Do not use WebSocket
- API keys live only in `.env`, never in code or committed files
