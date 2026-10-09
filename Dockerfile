FROM node:22-slim AS frontend-build

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend ./
COPY scripts/check-frontend-bundle-budget.mjs /scripts/check-frontend-bundle-budget.mjs
RUN npm run build


FROM python:3.12-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CDL_FRONTEND_DIST_DIR=/app/frontend-dist \
    PATH="/app/.venv/bin:${PATH}"

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

COPY pyproject.toml uv.lock ./
COPY alembic.ini ./
COPY migrations ./migrations
COPY src ./src
COPY --from=frontend-build /frontend/dist ./frontend-dist

RUN uv sync --frozen --no-dev --no-install-project && \
    uv sync --frozen --no-dev && \
    python -c "import cdl_api.migrate"

USER app

EXPOSE 8080

CMD ["sh", "-c", "/app/.venv/bin/uvicorn cdl_api.app:app --host 0.0.0.0 --port ${PORT:-8080}"]
