FROM node:22-slim AS frontend-build

WORKDIR /frontend

COPY frontend/package.json ./
RUN npm install --no-audit --no-fund

COPY frontend ./
RUN npm run build


FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CDL_FRONTEND_DIST_DIR=/app/frontend-dist

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

COPY pyproject.toml ./
COPY alembic.ini ./
COPY migrations ./migrations
COPY src ./src
COPY --from=frontend-build /frontend/dist ./frontend-dist

RUN pip install --upgrade pip && pip install .

USER app

EXPOSE 8080

CMD ["sh", "-c", "uvicorn cdl_api.app:app --host 0.0.0.0 --port ${PORT:-8080}"]
