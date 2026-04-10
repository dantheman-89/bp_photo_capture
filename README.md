# BP Monitor — Photo Capture

A mobile-first web app that photographs a blood pressure monitor and extracts SYS / DIA / Pulse values using a multimodal LLM.

## How it works

1. User points their phone camera at a blood pressure monitor
2. Photo is sent to the backend
3. Backend passes the image to OpenAI's vision model with a structured prompt
4. Extracted readings are returned and displayed

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS v4 |
| Backend | Python 3.11, FastAPI |
| LLM | OpenAI (vision) |
| Deployment | Docker → Render |

## Development

Requires Python 3.11, Node LTS, and [uv](https://docs.astral.sh/uv/).

**Terminal 1 — Backend**
```bash
cd backend
cp .env.example .env   # add your OPENAI_API_KEY
uv sync --dev
uv run uvicorn main:app --reload
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` requests to FastAPI on port 8000.

## Production build (Docker)

```bash
docker build -t bp-monitor .
docker run -p 8000:8000 -e OPENAI_API_KEY=your_key bp-monitor
```

Open `http://localhost:8000`. FastAPI serves the built React app directly — no Vite needed.

## Deploy to Render

1. Push repo to GitHub
2. New Web Service → Docker environment
3. Set `OPENAI_API_KEY` environment variable in Render dashboard
4. Deploy — Render runs `docker build` on every push to main
