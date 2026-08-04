"""PostgreSQL-backed fixtures, results, and scoring read model."""

from collections.abc import Callable, Iterable, Mapping

from sqlalchemy import JSON, Column, DateTime, MetaData, String, Table, insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.league_models import (
    EplFixtureContext,
    FixtureOutcome,
    FixtureScore,
    FixtureStatus,
    HeadToHeadRecord,
    HeadToHeadResponse,
    KnockoutMatch,
    KnockoutResponse,
    LeagueFixture,
    LeagueTableResponse,
    LeagueTableRow,
)
from cdl_api.repositories.league_repository import LeagueRepository
from cdl_api.repositories.postgres_league_fpl import draft_teams_table
from cdl_api.staging_draft_seed import LEAGUE_ID

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
        """Idempotently add missing deterministic fixture and table rows."""
        with self._session_factory() as session:
            fixture_ids = self._existing_ids(session, cdl_fixtures_table)
            result_ids = self._existing_ids(session, fixture_results_table)
            epl_fixture_ids = self._existing_ids(session, epl_fixtures_table)
            snapshot_ids = self._existing_ids(session, fixture_scoring_snapshots_table)
            table_snapshot_ids = self._existing_ids(session, league_table_snapshots_table)
            knockout_ids = self._existing_ids(session, knockout_matches_table)
            head_to_head_ids = self._existing_ids(session, head_to_head_records_table)

            base_fixtures = LeagueRepository().list_fixtures()
            fixtures = [
                *base_fixtures,
                *self._synthetic_result_parity_fixtures(base_fixtures),
            ]
            epl_fixtures = [
                EplFixtureContext(
                    id="epl-gw12-ars-che",
                    gameweek={"id": "epl-gw-12", "name": "Gameweek 12", "number": 12},
                    home_team={"id": "epl-ars", "name": "Arsenal", "short_name": "ARS"},
                    away_team={"id": "epl-che", "name": "Chelsea", "short_name": "CHE"},
                    status="started",
                    kickoff_label="GW12 synthetic scoring context",
                    synthetic=True,
                ),
                EplFixtureContext(
                    id="epl-gw12-liv-mci",
                    gameweek={"id": "epl-gw-12", "name": "Gameweek 12", "number": 12},
                    home_team={"id": "epl-liv", "name": "Liverpool", "short_name": "LIV"},
                    away_team={
                        "id": "epl-mci",
                        "name": "Manchester City",
                        "short_name": "MCI",
                    },
                    status="started",
                    kickoff_label="GW12 synthetic scoring context",
                    synthetic=True,
                ),
            ]
            for epl_fixture in epl_fixtures:
                if epl_fixture.id in epl_fixture_ids:
                    continue
                session.execute(
                    insert(epl_fixtures_table).values(
                        id=epl_fixture.id,
                        payload_json=epl_fixture.model_dump(mode="json"),
                    )
                )

            for fixture in fixtures:
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
                                "epl_fixture_ids": (
                                    [epl_fixture.id for epl_fixture in epl_fixtures]
                                    if fixture.id == "fixture-1201"
                                    else []
                                ),
                                "synthetic": True,
                            },
                        )
                    )

            table_snapshot_id = "table-gw-12"
            if table_snapshot_id not in table_snapshot_ids:
                from cdl_api.services.league_service import LeagueTableService

                table = LeagueTableService(LeagueRepository()).get_table()
                payload = table.model_dump(mode="json")
                payload.update(
                    {
                        "gameweek_id": "gw-12",
                        "source": "postgresql-synthetic-snapshot",
                        "synthetic": True,
                    }
                )
                session.execute(
                    insert(league_table_snapshots_table).values(
                        id=table_snapshot_id,
                        payload_json=payload,
                    )
                )

            for fixture in base_fixtures:
                if "Final" not in fixture.round_label or fixture.id in knockout_ids:
                    continue
                session.execute(
                    insert(knockout_matches_table).values(
                        id=fixture.id,
                        payload_json={
                            "fixture_id": fixture.id,
                            "round_label": fixture.round_label,
                            "rounds": ["Semi Final", "Final"],
                            "winner": None,
                            "synthetic": True,
                        },
                    )
                )

            for fixture in base_fixtures:
                if fixture.score.outcome == "pending":
                    continue
                record_id = f"head-to-head-{fixture.id}-{fixture.home_team.id}"
                if record_id in head_to_head_ids:
                    continue
                session.execute(
                    insert(head_to_head_records_table).values(
                        id=record_id,
                        payload_json={
                            "team": fixture.home_team.model_dump(mode="json"),
                            "opponent": fixture.away_team.model_dump(mode="json"),
                            "played": 1,
                            "wins": 1 if fixture.score.outcome == "home_win" else 0,
                            "draws": 1 if fixture.score.outcome == "draw" else 0,
                            "losses": 1 if fixture.score.outcome == "away_win" else 0,
                            "points_for": fixture.score.home_score or 0,
                            "points_against": fixture.score.away_score or 0,
                            "synthetic": True,
                        },
                    )
                )
            session.commit()

    @staticmethod
    def _synthetic_result_parity_fixtures(
        base_fixtures: list[LeagueFixture],
    ) -> list[LeagueFixture]:
        """Add explicit completed away-win and draw cases to the seed matrix."""
        teams = {
            team.id: team
            for fixture in base_fixtures
            for team in (fixture.home_team, fixture.away_team)
        }
        gameweek = GameweekSummary(id="gw-11", name="Gameweek 11", number=11)
        return [
            LeagueFixture(
                id="fixture-1101",
                gameweek=gameweek,
                home_team=teams["drafton"],
                away_team=teams["castle"],
                status=FixtureStatus.COMPLETE,
                kickoff_label="GW11 synthetic completed",
                round_label="Regular season",
                detail_available=True,
                score=FixtureScore(
                    home_score=45,
                    away_score=49,
                    outcome=FixtureOutcome.AWAY_WIN,
                ),
            ),
            LeagueFixture(
                id="fixture-1102",
                gameweek=gameweek,
                home_team=teams["keepers"],
                away_team=teams["wildcards"],
                status=FixtureStatus.COMPLETE,
                kickoff_label="GW11 synthetic completed",
                round_label="Regular season",
                detail_available=True,
                score=FixtureScore(
                    home_score=55,
                    away_score=55,
                    outcome=FixtureOutcome.DRAW,
                ),
            ),
        ]

    def list_fixtures(self) -> list[LeagueFixture]:
        with self._session_factory() as session:
            active_team_ids = set(
                session.execute(
                    select(draft_teams_table.c.id).where(draft_teams_table.c.league_id == LEAGUE_ID)
                ).scalars()
            )
            fixture_payloads = self._payloads(session, cdl_fixtures_table)
            result_payloads = self._payloads_by_fixture(session, fixture_results_table)
            snapshot_payloads = self._payloads_by_fixture(
                session,
                fixture_scoring_snapshots_table,
            )
            epl_fixture_payloads = {
                str(payload["id"]): payload
                for payload in self._payloads(session, epl_fixtures_table)
            }

        fixtures = []
        for payload in fixture_payloads:
            home_team = payload.get("home_team", {})
            away_team = payload.get("away_team", {})
            if active_team_ids and (
                not isinstance(home_team, Mapping)
                or not isinstance(away_team, Mapping)
                or home_team.get("id") not in active_team_ids
                or away_team.get("id") not in active_team_ids
            ):
                continue
            fixture_id = str(payload["id"])
            result = result_payloads.get(fixture_id, {})
            snapshot = snapshot_payloads.get(fixture_id, {})
            linked_epl_fixtures = []
            for epl_fixture_id in snapshot.get("epl_fixture_ids", []):
                epl_fixture = epl_fixture_payloads.get(str(epl_fixture_id))
                if epl_fixture is None:
                    raise MissingEplFixtureContextError(
                        f"Persisted EPL scoring fixture {epl_fixture_id!r} is missing."
                    )
                linked_epl_fixtures.append(EplFixtureContext.model_validate(epl_fixture))
            score = FixtureScore(
                home_score=result.get("home_score"),
                away_score=result.get("away_score"),
                outcome=result.get("outcome", "pending"),
                bonus_points=snapshot.get("bonus_points", {}),
                chips_played=snapshot.get("chips_played", {}),
                epl_fixtures=linked_epl_fixtures,
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

    def get_table_snapshot(self) -> LeagueTableResponse:
        """Return the newest persisted table snapshot without fixture fallback."""
        with self._session_factory() as session:
            active_teams = list(
                session.execute(
                    select(draft_teams_table.c.id, draft_teams_table.c.name)
                    .where(draft_teams_table.c.league_id == LEAGUE_ID)
                    .order_by(draft_teams_table.c.name)
                ).mappings()
            )
            payloads = self._payloads(session, league_table_snapshots_table)

        if active_teams:
            active_team_ids = {str(team["id"]) for team in active_teams}
            for payload in reversed(payloads):
                snapshot = LeagueTableResponse.model_validate(payload)
                snapshot_team_ids = {row.team.id for row in snapshot.rows}
                if snapshot_team_ids and snapshot_team_ids <= active_team_ids:
                    return snapshot
            return LeagueTableResponse(
                rows=[
                    LeagueTableRow(
                        position=index,
                        team=TeamSummary(id=str(team["id"]), name=str(team["name"])),
                        played=0,
                        wins=0,
                        draws=0,
                        losses=0,
                        points_for=0,
                        points_against=0,
                        points_difference=0,
                        league_points=0,
                    )
                    for index, team in enumerate(active_teams, start=1)
                ],
                source="postgresql-active-season",
            )

        if not payloads:
            raise MissingLeagueTableSnapshotError(
                "PostgreSQL mode requires a persisted league table snapshot."
            )
        return LeagueTableResponse.model_validate(payloads[-1])

    def get_knockout_snapshot(self) -> KnockoutResponse:
        """Return persisted knockout matches without fixture-derived fallback."""
        with self._session_factory() as session:
            payloads = self._payloads(session, knockout_matches_table)

        if not payloads and self._active_team_ids():
            return KnockoutResponse(rounds=[], matches=[])
        if not payloads:
            raise MissingKnockoutSnapshotError(
                "PostgreSQL mode requires persisted knockout matches."
            )

        fixtures = {fixture.id: fixture for fixture in self.list_fixtures()}
        matches = []
        rounds: list[str] = []
        active_team_ids = self._active_team_ids()
        for payload in payloads:
            fixture_id = str(payload["fixture_id"])
            fixture = fixtures.get(fixture_id)
            if fixture is None:
                if active_team_ids:
                    continue
                raise MissingKnockoutSnapshotError(
                    f"Persisted knockout fixture {fixture_id!r} is missing."
                )
            for round_label in payload.get("rounds", []):
                if isinstance(round_label, str) and round_label not in rounds:
                    rounds.append(round_label)
            matches.append(
                KnockoutMatch.model_validate(
                    {
                        "id": fixture_id,
                        "round_label": payload["round_label"],
                        "fixture": fixture,
                        "winner": payload.get("winner"),
                    }
                )
            )
        return KnockoutResponse(rounds=rounds if matches else [], matches=matches)

    def get_head_to_head_snapshot(self) -> HeadToHeadResponse:
        """Return persisted matchup records without fixture-result fallback."""
        with self._session_factory() as session:
            payloads = self._payloads(session, head_to_head_records_table)

        active_team_ids = self._active_team_ids()
        if not payloads and active_team_ids:
            return HeadToHeadResponse(records=[])
        if not payloads:
            raise MissingHeadToHeadSnapshotError(
                "PostgreSQL mode requires persisted head-to-head records."
            )
        records = [HeadToHeadRecord.model_validate(payload) for payload in payloads]
        if active_team_ids:
            records = [
                record
                for record in records
                if record.team.id in active_team_ids and record.opponent.id in active_team_ids
            ]
        return HeadToHeadResponse(records=records)

    def _active_team_ids(self) -> set[str]:
        with self._session_factory() as session:
            return set(
                session.execute(
                    select(draft_teams_table.c.id).where(draft_teams_table.c.league_id == LEAGUE_ID)
                ).scalars()
            )

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


class MissingLeagueTableSnapshotError(RuntimeError):
    """Raised instead of silently calculating standings in PostgreSQL mode."""


class MissingKnockoutSnapshotError(RuntimeError):
    """Raised instead of deriving knockout matches in PostgreSQL mode."""


class MissingHeadToHeadSnapshotError(RuntimeError):
    """Raised instead of deriving matchup records in PostgreSQL mode."""


class MissingEplFixtureContextError(RuntimeError):
    """Raised when a scoring snapshot references absent EPL fixture context."""
