from pathlib import Path

FEATURE_PATH = Path("docs/features/active/local-and-ci-postgresql-foundation.md")
COMPOSE_PATH = Path("docker-compose.yml")
ALEMBIC_PATH = Path("alembic.ini")
MIGRATION_ENV_PATH = Path("migrations/env.py")
BASELINE_MIGRATION_PATH = Path("migrations/versions/0001_create_migration_probe.py")
POSTGRES_WORKFLOW_PATH = Path(".github/workflows/backend-postgres.yml")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_feature_documents_local_and_ci_postgresql_scope() -> None:
    content = read(FEATURE_PATH)

    for phrase in [
        "Active implementation feature for issue #61",
        "Parent coordinator: #75",
        "Parent milestone: #76",
        "Depends on: #60",
        "docker compose up -d postgres",
        "uv run alembic upgrade head",
        "#78 remains blocked",
    ]:
        assert phrase in content


def test_local_postgresql_compose_service_is_available() -> None:
    content = read(COMPOSE_PATH)

    for phrase in [
        "postgres:16-alpine",
        "POSTGRES_DB: cdl",
        "POSTGRES_USER: cdl",
        "POSTGRES_PASSWORD: cdl",
        "pg_isready -U cdl -d cdl",
        "5432:5432",
    ]:
        assert phrase in content


def test_alembic_baseline_configuration_is_available() -> None:
    alembic_content = read(ALEMBIC_PATH)
    env_content = read(MIGRATION_ENV_PATH)
    migration_content = read(BASELINE_MIGRATION_PATH)

    assert "script_location = migrations" in alembic_content
    assert "CDL_DATABASE_URL" in env_content
    assert "postgresql+psycopg://cdl:cdl@localhost:5432/cdl" in env_content
    assert "0001_create_migration_probe" in migration_content
    assert "migration_probe" in migration_content


def test_postgresql_smoke_workflow_runs_migrations() -> None:
    content = read(POSTGRES_WORKFLOW_PATH)

    for phrase in [
        "name: Backend PostgreSQL",
        "postgres:16-alpine",
        "CDL_DATABASE_URL",
        "uv run alembic upgrade head",
    ]:
        assert phrase in content
