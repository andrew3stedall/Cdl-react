from __future__ import annotations

import os
from dataclasses import dataclass

from cdl_api.database import build_session_factory
from cdl_api.repositories.postgres_auth import PostgreSQLUserRepository
from cdl_api.repositories.postgres_league_fixtures import PostgreSQLLeagueRepository
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.settings import Settings
from cdl_api.staging_draft_reroll import reroll_staging_draft_assignments
from cdl_api.staging_draft_seed import seed_staging_snake_draft

SEED_CONFIRMATION_ENV = "CDL_ALLOW_SYNTHETIC_STAGING_SEED"
SEED_CONFIRMATION_VALUE = "true"


@dataclass(frozen=True)
class SeedResult:
    environment: str
    synthetic: bool
    domains: tuple[str, ...]


def seed_synthetic_staging_data(settings: Settings | None = None) -> SeedResult:
    """Idempotently load the explicitly synthetic staging fixture set."""
    resolved = settings or Settings()

    if resolved.environment != "staging":
        raise RuntimeError("Synthetic staging seed is restricted to CDL_ENVIRONMENT=staging.")
    if resolved.repository_mode != "postgres":
        raise RuntimeError("Synthetic staging seed requires CDL_REPOSITORY_MODE=postgres.")
    if not resolved.database_url.startswith(("postgresql://", "postgresql+psycopg://")):
        raise RuntimeError(
            "Synthetic staging seed requires an explicit PostgreSQL CDL_DATABASE_URL."
        )
    if os.environ.get(SEED_CONFIRMATION_ENV, "").lower() != SEED_CONFIRMATION_VALUE:
        raise RuntimeError(
            f"Set {SEED_CONFIRMATION_ENV}={SEED_CONFIRMATION_VALUE} to confirm "
            "synthetic staging data."
        )

    session_factory = build_session_factory(resolved)
    PostgreSQLUserRepository(session_factory).seed_demo_user()
    PostgreSQLSquadRepository(session_factory).seed_demo_data()
    draft_result = seed_staging_snake_draft(session_factory)
    reroll_result = reroll_staging_draft_assignments(session_factory)
    PostgreSQLLeagueRepository(session_factory).seed_synthetic_data()

    return SeedResult(
        environment=resolved.environment,
        synthetic=True,
        domains=(
            "identity",
            f"draft:{draft_result.teams}-teams/{reroll_result.ownerships}-ownerships",
            f"lineup-reset:{reroll_result.cleared_lineup_rows}-rows",
            "league",
        ),
    )


def main() -> None:
    result = seed_synthetic_staging_data()
    print("Seeded explicitly synthetic staging domains: " + ", ".join(result.domains))


if __name__ == "__main__":
    main()
