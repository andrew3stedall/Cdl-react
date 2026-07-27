from __future__ import annotations

import os
from pathlib import Path

from alembic import command
from alembic.config import Config

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

    command.upgrade(Config(str(config_path)), "head")


def main() -> None:
    run_migrations()


if __name__ == "__main__":
    main()
