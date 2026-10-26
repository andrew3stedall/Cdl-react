"""Explicitly remove synthetic fixture rows from the staging database."""

from __future__ import annotations

import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from cdl_api.database import build_session_factory
from cdl_api.repositories.postgres_league_fixtures import (
    cdl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
)
from cdl_api.settings import Settings

CLEANUP_CONFIRMATION_ENV = "CDL_ALLOW_SYNTHETIC_FIXTURE_CLEANUP"
CLEANUP_CONFIRMATION_VALUE = "true"


@dataclass(frozen=True)
class SyntheticFixtureCleanupResult:
    """Counts for fixture rows and dependent scoring rows removed in one transaction."""

    fixtures: int
    results: int
    scoring_snapshots: int


def _related_row_ids(
    session: Session,
    table: object,
    fixture_ids: set[str],
) -> list[str]:
    rows = session.execute(select(table.c.id, table.c.payload_json)).mappings()
    return [
        str(row["id"])
        for row in rows
        if isinstance(row["payload_json"], Mapping)
        and str(row["payload_json"].get("fixture_id", "")) in fixture_ids
    ]


def cleanup_synthetic_fixture_rows(
    session_factory: Callable[[], Session],
) -> SyntheticFixtureCleanupResult:
    """Delete fixture rows with synthetic=true plus rows that reference those fixtures.

    Selection is based on the persisted payload marker, not gameweek, fixture ID
    prefix, team names, or score. Castle-imported rows without that marker remain.
    """
    with session_factory() as session:
        with session.begin():
            fixtures = session.execute(
                select(cdl_fixtures_table.c.id, cdl_fixtures_table.c.payload_json).where(
                    cdl_fixtures_table.c.payload_json["synthetic"].as_boolean().is_(True)
                )
            ).mappings()
            fixture_ids = {
                str(row["id"])
                for row in fixtures
                if isinstance(row["payload_json"], Mapping)
                and row["payload_json"].get("synthetic") is True
            }
            if not fixture_ids:
                return SyntheticFixtureCleanupResult(fixtures=0, results=0, scoring_snapshots=0)

            result_ids = _related_row_ids(session, fixture_results_table, fixture_ids)
            snapshot_ids = _related_row_ids(session, fixture_scoring_snapshots_table, fixture_ids)
            if result_ids:
                session.execute(
                    delete(fixture_results_table).where(fixture_results_table.c.id.in_(result_ids))
                )
            if snapshot_ids:
                session.execute(
                    delete(fixture_scoring_snapshots_table).where(
                        fixture_scoring_snapshots_table.c.id.in_(snapshot_ids)
                    )
                )
            session.execute(
                delete(cdl_fixtures_table).where(cdl_fixtures_table.c.id.in_(fixture_ids))
            )

    return SyntheticFixtureCleanupResult(
        fixtures=len(fixture_ids),
        results=len(result_ids),
        scoring_snapshots=len(snapshot_ids),
    )


def remove_synthetic_staging_fixtures(settings: Settings | None = None) -> SyntheticFixtureCleanupResult:
    """Run the guarded PostgreSQL cleanup against the staging environment only."""
    resolved = settings or Settings()

    if resolved.environment != "staging":
        raise RuntimeError("Synthetic fixture cleanup is restricted to CDL_ENVIRONMENT=staging.")
    if resolved.repository_mode != "postgres":
        raise RuntimeError("Synthetic fixture cleanup requires CDL_REPOSITORY_MODE=postgres.")
    if not resolved.database_url.startswith(("postgresql://", "postgresql+psycopg://")):
        raise RuntimeError(
            "Synthetic fixture cleanup requires an explicit PostgreSQL CDL_DATABASE_URL."
        )
    if os.environ.get(CLEANUP_CONFIRMATION_ENV, "").lower() != CLEANUP_CONFIRMATION_VALUE:
        raise RuntimeError(
            f"Set {CLEANUP_CONFIRMATION_ENV}={CLEANUP_CONFIRMATION_VALUE} to confirm "
            "synthetic fixture cleanup."
        )

    return cleanup_synthetic_fixture_rows(build_session_factory(resolved))


def main() -> None:
    result = remove_synthetic_staging_fixtures()
    print(
        "Removed synthetic staging rows: "
        f"fixtures={result.fixtures}, results={result.results}, "
        f"scoring_snapshots={result.scoring_snapshots}"
    )


if __name__ == "__main__":
    main()
