from __future__ import annotations

import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine

DATABASE_URL_ENV = "CDL_DATABASE_URL"
ALEMBIC_CONFIG_ENV = "CDL_ALEMBIC_CONFIG"
DEFAULT_ALEMBIC_CONFIG = "alembic.ini"


def run_migrations() -> None:
    """Upgrade the configured database to the current Alembic head revision."""
    if not os.environ.get(DATABASE_URL_ENV):
        raise RuntimeError(
            f"{DATABASE_URL_ENV} must be set; the migration entrypoint will not use "
            "Alembic's local-development fallback database URL."
        )

    config_path = Path(os.environ.get(ALEMBIC_CONFIG_ENV, DEFAULT_ALEMBIC_CONFIG))
    if not config_path.is_file():
        raise FileNotFoundError(f"Alembic configuration not found: {config_path}")

    config = Config(str(config_path))
    command.upgrade(config, "head")
    verify_schema_head(config, os.environ[DATABASE_URL_ENV])


def verify_schema_head(config: Config, database_url: str) -> None:
    """Fail the job unless PostgreSQL reports every checked-in Alembic head."""
    expected_heads = set(ScriptDirectory.from_config(config).get_heads())
    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            current_heads = set(MigrationContext.configure(connection).get_current_heads())
    finally:
        engine.dispose()

    if current_heads != expected_heads:
        expected = ", ".join(sorted(expected_heads)) or "<no heads>"
        current = ", ".join(sorted(current_heads)) or "<none>"
        raise RuntimeError(
            f"Alembic schema verification failed: expected [{expected}], found [{current}]."
        )
    print("Alembic schema verification passed: " + ", ".join(sorted(current_heads)))


def main() -> None:
    run_migrations()


if __name__ == "__main__":
    main()
