"""PostgreSQL-backed fixtures, results, and scoring read model."""

from collections.abc import Callable, Iterable, Mapping

from sqlalchemy import JSON, Column, DateTime, MetaData, String, Table, insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.league_models import FixtureScore, LeagueFixture
from cdl_api.repositories.league_repository import LeagueRepository

metadata = MetaData()


def _persistence_table(name: str) -> Table:
    """Match the append-only payload schema created by migration 0006."""
    return Table(
        name,
        metadata,
        Column("id", String(64), primary_key=True),
        Column("payload_json", JSON(), nullable=False),
        Column("created_at", DateTime(timezone=True), nullable=True),
    )


cdl_fixtures_table = _persistence_table("cdl_fixtures")
epl_fixtures_table = _persistence_table("epl_fixtures")
fixture_results_table = _persistence_table("fixture_results")
fixture_scoring_snapshots_table = _persistence_table("fixture_scoring_snapshots")
league_table_snapshots_table = _persistence_table("league_table_snapshots")
knockout_matches_table = _persistence_table("knockout_matches")
head_to_head_records_table = _persistence_table("head_to_head_records")

LEAGUE_FIXTURE_PERSISTENCE_TABLES = (
    cdl_fixtures_table,
    epl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
    league_table_snapshots_table,
    knockout_matches_table,
    head_to_head_records_table,
)


def _mapping_rows(result: object) -> list[Mapping[str, object]]:
    try:
        mappings: Iterable[Mapping[str, object]] = result.mappings()
    except AttributeError:
        return []
    return list(mappings)


class PostgreSQLLeagueRepository:
    """Read league fixtures from the migrated PostgreSQL payload tables."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def seed_synthetic_data(self) -> None:
        """Idempotently add missing deterministic rows to the three read tables."""
        with self._session_factory() as session:
            fixture_ids = self._existing_ids(session, cdl_fixtures_table)
            result_ids = self._existing_ids(session, fixture_results_table)
            snapshot_ids = self._existing_ids(session, fixture_scoring_snapshots_table)

            for fixture in LeagueRepository().list_fixtures():
                fixture_payload = fixture.model_dump(mode="json", exclude={"score"})
                fixture_payload["synthetic"] = True
                if fixture.id not in fixture_ids:
                    session.execute(
                        insert(cdl_fixtures_table).values(
                            id=fixture.id,
                            payload_json=fixture_payload,
                        )
                    )
                result_id = f"result-{fixture.id}"
                if result_id not in result_ids:
                    session.execute(
                        insert(fixture_results_table).values(
                            id=result_id,
                            payload_json={
                                "fixture_id": fixture.id,
                                "home_score": fixture.score.home_score,
                                "away_score": fixture.score.away_score,
                                "outcome": fixture.score.outcome.value,
                                "synthetic": True,
                            },
                        )
                    )
                snapshot_id = f"snapshot-{fixture.id}"
                if snapshot_id not in snapshot_ids:
                    session.execute(
                        insert(fixture_scoring_snapshots_table).values(
                            id=snapshot_id,
                            payload_json={
                                "fixture_id": fixture.id,
                                "bonus_points": fixture.score.bonus_points,
                                "chips_played": fixture.score.chips_played,
                                "synthetic": True,
                            },
                        )
                    )
            session.commit()

    def list_fixtures(self) -> list[LeagueFixture]:
        with self._session_factory() as session:
            fixture_payloads = self._payloads(session, cdl_fixtures_table)
            result_payloads = self._payloads_by_fixture(session, fixture_results_table)
            snapshot_payloads = self._payloads_by_fixture(
                session,
                fixture_scoring_snapshots_table,
            )

        fixtures = []
        for payload in fixture_payloads:
            fixture_id = str(payload["id"])
            result = result_payloads.get(fixture_id, {})
            snapshot = snapshot_payloads.get(fixture_id, {})
            score = FixtureScore(
                home_score=result.get("home_score"),
                away_score=result.get("away_score"),
                outcome=result.get("outcome", "pending"),
                bonus_points=snapshot.get("bonus_points", {}),
                chips_played=snapshot.get("chips_played", {}),
            )
            fixtures.append(LeagueFixture.model_validate({**payload, "score": score}))
        return fixtures

    def get_fixture(self, fixture_id: str) -> LeagueFixture | None:
        return next(
            (fixture for fixture in self.list_fixtures() if fixture.id == fixture_id),
            None,
        )

    def list_current_fixtures(self) -> list[LeagueFixture]:
        return [fixture for fixture in self.list_fixtures() if fixture.is_current]

    def list_next_fixtures(self) -> list[LeagueFixture]:
        return [fixture for fixture in self.list_fixtures() if fixture.is_next]

    @staticmethod
    def _payloads(session: Session, table: Table) -> list[dict[str, object]]:
        result = session.execute(select(table.c.payload_json).order_by(table.c.id))
        return [
            dict(row["payload_json"])
            for row in _mapping_rows(result)
            if isinstance(row["payload_json"], Mapping)
        ]

    @staticmethod
    def _existing_ids(session: Session, table: Table) -> set[str]:
        result = session.execute(select(table.c.id))
        return {str(row[0]) for row in result}

    @classmethod
    def _payloads_by_fixture(
        cls,
        session: Session,
        table: Table,
    ) -> dict[str, dict[str, object]]:
        return {str(payload["fixture_id"]): payload for payload in cls._payloads(session, table)}
