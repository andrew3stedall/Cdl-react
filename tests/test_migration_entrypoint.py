from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from cdl_api import migrate

MIGRATION_RUNBOOK = Path("docs/runbooks/gcp-staging-database-migrations.md")


def test_migration_entrypoint_requires_explicit_database_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(migrate.DATABASE_URL_ENV, raising=False)

    with pytest.raises(RuntimeError, match="CDL_DATABASE_URL must be set"):
        migrate.run_migrations()


def test_migration_entrypoint_rejects_missing_configuration(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv(migrate.DATABASE_URL_ENV, "postgresql+psycopg://example")
    missing_config = tmp_path / "missing.ini"
    monkeypatch.setenv(migrate.ALEMBIC_CONFIG_ENV, str(missing_config))

    with pytest.raises(FileNotFoundError, match="Alembic configuration not found"):
        migrate.run_migrations()


def test_migration_entrypoint_upgrades_to_head(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls: list[tuple[Any, str]] = []
    config_path = tmp_path / "alembic.ini"
    config_path.write_text("[alembic]\nscript_location = migrations\n", encoding="utf-8")
    monkeypatch.setenv(migrate.DATABASE_URL_ENV, "postgresql+psycopg://example")
    monkeypatch.setenv(migrate.ALEMBIC_CONFIG_ENV, str(config_path))
    monkeypatch.setattr(
        migrate.command,
        "upgrade",
        lambda config, revision: calls.append((config, revision)),
    )

    migrate.run_migrations()

    assert len(calls) == 1
    config, revision = calls[0]
    assert revision == "head"
    assert config.config_file_name == str(config_path)


def test_backend_image_packages_migration_assets() -> None:
    dockerfile = Path("Dockerfile").read_text(encoding="utf-8")

    assert "COPY alembic.ini ./" in dockerfile
    assert "COPY migrations ./migrations" in dockerfile
    assert "COPY src ./src" in dockerfile


def test_staging_migration_runbook_preserves_controlled_execution_boundary() -> None:
    content = MIGRATION_RUNBOOK.read_text(encoding="utf-8")

    for phrase in [
        "python -m cdl_api.migrate",
        "CDL_DATABASE_URL",
        "dedicated migration service account",
        "immutable backend image digest",
        "Migration and seed execution must remain separate",
        "Cloud SQL connectivity",
        "issues #70 and #78",
    ]:
        assert phrase in content
