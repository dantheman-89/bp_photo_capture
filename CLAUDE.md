# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`bp_photo_capture` is a mobile-first web app for feasibility testing: capture a live photo of a blood pressure monitor screen and extract SYS / DIA / Pulse using a multimodal LLM. This is a personal feasibility project, not a polished production app.

- No login
- Live camera only (no file upload in the intended MVP flow)
- Frontend sends photo to backend; backend calls the LLM vendor SDK using server-side API keys (never expose API keys to the browser)

## Repo Structure

```
bp_photo_capture/        ← repo root (coordination, docs, infra)
├── backend/             ← Python / FastAPI
├── frontend/            ← React + Vite + Tailwind CSS (not yet started)
└── infra/               ← deployment config (not yet started)
```

Each subdirectory manages its own environment (`backend/` has Python env, `frontend/` has Node/npm). The root is not itself a Python or Node package.

## Deployment Direction

One-container MVP: Vite builds the frontend into static assets, and FastAPI serves both the API and the built frontend files.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Config | Pydantic Settings + `.env` |
| File uploads | python-multipart |
| Testing | pytest (backend) |
| Package mgr (backend) | uv |
| Package mgr (frontend) | npm |

Do not add `httpx` unless there is a specific reason — the LLM call goes through a vendor SDK, not raw HTTP.

## Backend

All backend commands run from the `backend/` directory.

### Setup (first time)

```bash
cd backend
uv init --python 3.11 --name bp-photo-capture-backend
uv add fastapi uvicorn python-multipart pydantic-settings
uv add --dev pytest
uv lock
uv sync
# Then tighten pyproject.toml: requires-python = ">=3.11,<3.12"
```

Python version is pinned via both `.python-version` (created by `uv init --python 3.11`) and the `requires-python = ">=3.11,<3.12"` bound in `pyproject.toml`. Both are intentional — the open-ended `>=3.11` default from `uv init` is always tightened to `<3.12`.

### Daily commands

```bash
cd backend

uv sync --dev          # install / sync all deps including dev
uv run uvicorn main:app --reload   # run dev server
uv run pytest                      # run all tests
uv run pytest tests/path/to/test_file.py                    # single file
uv run pytest tests/path/to/test_file.py::test_function_name  # single test
uv add <package>       # add a runtime dependency
uv add --dev <package> # add a dev dependency
```

### Configuration

Copy `backend/.env.sample` to `backend/.env` and fill in values. Settings are loaded via Pydantic Settings. Never commit `.env`.

### Test structure

Tests live in `backend/tests/`. Start flat (all test files directly under `tests/`). Only introduce `unit/`, `integration/`, `e2e/` subdirectories if the test suite grows enough to need it.

## Frontend

### Stack

- **React** — UI library
- **JSX** — HTML-like syntax inside JS files for React components
- **Vite** — frontend dev server and build tool (produces browser-ready static assets)
- **Tailwind CSS** — utility-first CSS framework

### Setup (first time, Windows)

Prerequisites: Node.js installed (includes npm). Check with:
```bash
node --version
npm --version
```

Initialize the frontend:
```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npx tailwindcss init -p   # add Tailwind after Vite init
npm install -D tailwindcss postcss autoprefixer
```

### Daily commands

```bash
cd frontend
npm install        # install deps from package.json (e.g. after pulling changes)
npm run dev        # start Vite dev server (default: http://localhost:5173)
npm run build      # build static assets into frontend/dist/
npm run preview    # preview the production build locally
```

### Connecting frontend dev to backend

During development, Vite dev server runs on port 5173 and FastAPI runs on port 8000. Configure a Vite proxy in `vite.config.js` so that API calls from the frontend (e.g. `fetch('/api/...')`) are forwarded to the FastAPI server without CORS issues:

```js
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
}
```

### package.json and package-lock.json

- `package.json` — declares dependencies and scripts; analogous to `pyproject.toml`
- `package-lock.json` — exact locked versions of the full dependency tree; analogous to `uv.lock`. Commit both files.
- `node_modules/` — installed packages; do not commit (add to `.gitignore`)

### Test structure

Frontend tests live in `frontend/src/` co-located with components (e.g. `Button.test.jsx` next to `Button.jsx`), or in `frontend/tests/`. Use Vitest (compatible with Vite) for unit/component tests.

## Cross-stack integration and e2e tests

For tests that exercise the full stack (browser → frontend → backend → LLM mock):
- Use Playwright or Cypress, typically in a top-level `e2e/` directory at the repo root
- These are only worth adding once the basic flows are stable
- Start without them; add when manual testing becomes the bottleneck

## MVP UI States

The frontend is a single-page camera tool, not a form. Key states:

1. **Initial** — live camera preview, short instruction, "Take photo" button, empty result panel
2. **Processing** — frozen captured image, loading indicator in result panel
3. **Success** — show SYS / DIA / Pulse, Retake + Submit buttons
4. **Low-confidence / failed** — prompt user to retake
5. **Repeated failure (3×)** — allow manual review/entry

Do not show controls that are irrelevant to the current state (e.g. no Retake button before a photo has been taken). Layout: top ~2/3 camera/image area, bottom ~1/3 result panel.
