# =============================================================================
# Stage 1: Build the React frontend
# =============================================================================
FROM node:22-slim AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first — separate layer so it's cached unless
# package-lock.json changes (avoids re-downloading on every code change)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source and build — produces /app/frontend/dist/
COPY frontend/ ./
RUN npm run build


# =============================================================================
# Stage 2: Python runtime
# =============================================================================
FROM python:3.11-slim AS runtime

# Install uv — used only during image build to install Python deps
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies from the lock file
# --no-dev: skip pytest/httpx/etc.
# --frozen: treat uv.lock as authoritative, fail if it's out of sync with pyproject.toml
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --no-dev --frozen

# Copy backend source
COPY backend/ ./

# Copy the built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Render injects PORT at runtime; default to 8000 for local testing
ENV PORT=8000

EXPOSE 8000

CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
