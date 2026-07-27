"""PostgreSQL-backed fixture difficulty rating reads and calculation persistence."""

from collections.abc import Callable, Mapping

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.fdr import (
    FixtureDifficultyBand,
    FixtureDifficultyCalculationFixtureInput,
    FixtureDifficultyCalculationInputAudit,
    FixtureDifficultyCalculationRunResult,
    FixtureDifficultyFixture,
    FixtureDifficultyScaleStep,
    FixtureDifficultyView,
)
from cdl_api.repositories.postgres_dashboard_fdr import (
    fdr_calculation_inputs_table,
    fdr_ratings_table,
)
from cdl_api.services.fdr_calculation_service import FixtureDifficultyCalculationService


class PostgreSQLFixtureDifficultyRepository:
    """Read and calculate FDR data only through migration-0007 payloads."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def _payloads(self, season: str) -> list[dict[str, object]]:
        valid_runs = {
            audit.calculation_run_id: audit.algorithm_version
            for audit in self.list_calculation_inputs(season)
        }
        with self._session_factory() as session:
            rows = session.execute(
                select(fdr_ratings_table.c.id, fdr_ratings_table.c.payload_json).order_by(
                    fdr_ratings_table.c.id
                )
            ).mappings()
            payloads: list[dict[str, object]] = []
            for row in rows:
                payload = row["payload_json"]
                if not isinstance(payload, Mapping):
                    raise ValueError("FDR rating payload must be a JSON object.")
                if payload.get("season") != season:
                    continue
                calculation_run_id = payload.get("calculation_run_id")
                if not isinstance(calculation_run_id, str):
                    continue
                if valid_runs.get(calculation_run_id) != payload.get("algorithm_version"):
                    continue
                payloads.append({"id": str(row["id"]), **dict(payload)})
            return payloads

    def list_teams(self, season: str) -> list[TeamSummary]:
        teams: dict[str, TeamSummary] = {}
        for payload in self._payloads(season):
            for prefix in ("team", "opponent"):
                team_id = str(payload[f"{prefix}_id"])
                teams[team_id] = TeamSummary(
                    id=team_id,
                    name=str(payload[f"{prefix}_name"]),
                    short_name=str(payload[f"{prefix}_short_name"]),
                )
        return sorted(teams.values(), key=lambda team: team.name)

    def list_gameweeks(self, season: str) -> list[GameweekSummary]:
        numbers = sorted({int(payload["gameweek"]) for payload in self._payloads(season)})
        return [
            GameweekSummary(id=f"gw-{number}", name=f"Gameweek {number}", number=number)
            for number in numbers
        ]

    def list_scales(self) -> list[FixtureDifficultyScaleStep]:
        scale_rows = (
            (1, FixtureDifficultyBand.VERY_EASY, "Very easy", 7.8),
            (2, FixtureDifficultyBand.EASY, "Easy", 6.9),
            (3, FixtureDifficultyBand.MEDIUM, "Medium", 5.4),
            (4, FixtureDifficultyBand.HARD, "Hard", 6.1),
            (5, FixtureDifficultyBand.VERY_HARD, "Very hard", 7.2),
        )
        return [
            FixtureDifficultyScaleStep(
                rating=rating,
                band=band,
                label=label,
                foreground_token=f"fdr-{rating}-foreground",
                background_token=f"fdr-{rating}-background",
                contrast_ratio=contrast_ratio,
            )
            for rating, band, label, contrast_ratio in scale_rows
        ]

    def list_calculation_inputs(
        self,
        season: str,
    ) -> list[FixtureDifficultyCalculationInputAudit]:
        with self._session_factory() as session:
            rows = session.execute(
                select(
                    fdr_calculation_inputs_table.c.id,
                    fdr_calculation_inputs_table.c.payload_json,
                ).order_by(fdr_calculation_inputs_table.c.id)
            ).mappings()
            audits: list[FixtureDifficultyCalculationInputAudit] = []
            for row in rows:
                payload = row["payload_json"]
                if not isinstance(payload, Mapping):
                    raise ValueError("FDR calculation input payload must be a JSON object.")
                if payload.get("season") != season:
                    continue
                audits.append(
                    FixtureDifficultyCalculationInputAudit.model_validate(
                        {"id": str(row["id"]), **dict(payload)}
                    )
                )
            return audits

    def get_calculation_input_payload(
        self,
        season: str,
        calculation_run_id: str,
    ) -> dict[str, object] | None:
        matches: list[dict[str, object]] = []
        with self._session_factory() as session:
            rows = session.execute(
                select(
                    fdr_calculation_inputs_table.c.id,
                    fdr_calculation_inputs_table.c.payload_json,
                ).order_by(fdr_calculation_inputs_table.c.id)
            ).mappings()
            for row in rows:
                payload = row["payload_json"]
                if not isinstance(payload, Mapping):
                    raise ValueError("FDR calculation input payload must be a JSON object.")
                if payload.get("season") != season:
                    continue
                if payload.get("calculation_run_id") != calculation_run_id:
                    continue
                matches.append({"id": str(row["id"]), **dict(payload)})
        if len(matches) > 1:
            raise ValueError("FDR calculation run has more than one persisted input.")
        return matches[0] if matches else None

    def list_fixtures(
        self,
        view: FixtureDifficultyView,
        season: str,
    ) -> dict[str, list[FixtureDifficultyFixture]]:
        fixtures: dict[str, list[FixtureDifficultyFixture]] = {
            team.id: [] for team in self.list_teams(season)
        }
        for payload in self._payloads(season):
            if payload.get("view") != view.value:
                continue
            team_id = str(payload["team_id"])
            opponent = TeamSummary(
                id=str(payload["opponent_id"]),
                name=str(payload["opponent_name"]),
                short_name=str(payload["opponent_short_name"]),
            )
            gameweek_number = int(payload["gameweek"])
            venue = str(payload["venue"])
            fixtures.setdefault(team_id, []).append(
                FixtureDifficultyFixture(
                    id=str(payload["id"]),
                    opponent=opponent,
                    gameweek=GameweekSummary(
                        id=f"gw-{gameweek_number}",
                        name=f"Gameweek {gameweek_number}",
                        number=gameweek_number,
                    ),
                    venue=venue,
                    rating=int(payload["rating"]),
                    band=FixtureDifficultyBand(str(payload["band"])),
                    abbreviation=f"{opponent.short_name or opponent.name} ({venue})",
                )
            )
        for team_fixtures in fixtures.values():
            team_fixtures.sort(key=lambda fixture: fixture.gameweek.number)
        return fixtures

    def persist_calculated_ratings(
        self,
        ratings: list[tuple[str, dict[str, object]]],
    ) -> tuple[int, int]:
        for _, payload in ratings:
            season = payload.get("season")
            calculation_run_id = payload.get("calculation_run_id")
            algorithm_version = payload.get("algorithm_version")
            if not isinstance(season, str) or not isinstance(calculation_run_id, str):
                raise ValueError("Calculated FDR rating is missing its run identity.")
            input_payload = self.get_calculation_input_payload(season, calculation_run_id)
            if input_payload is None:
                raise ValueError("Calculated FDR rating references a missing input run.")
            if input_payload.get("algorithm_version") != algorithm_version:
                raise ValueError("Calculated FDR rating algorithm does not match its input run.")

        with self._session_factory() as session:
            existing_payloads: dict[str, object] = {}
            rows = session.execute(
                select(fdr_ratings_table.c.id, fdr_ratings_table.c.payload_json)
            ).mappings()
            for row in rows:
                existing_payloads[str(row["id"])] = row["payload_json"]

            created = 0
            unchanged = 0
            for rating_id, payload in ratings:
                existing_payload = existing_payloads.get(rating_id)
                if existing_payload is None:
                    session.execute(
                        insert(fdr_ratings_table).values(
                            id=rating_id,
                            payload_json=payload,
                        )
                    )
                    created += 1
                    continue
                if not isinstance(existing_payload, Mapping):
                    raise ValueError("Existing FDR rating payload must be a JSON object.")
                if dict(existing_payload) != payload:
                    raise ValueError(
                        f"Calculated FDR rating conflicts with persisted row {rating_id}."
                    )
                unchanged += 1
            session.commit()
        return created, unchanged

    def seed_synthetic_calculation_input(self) -> str:
        """Persist one deterministic input contract without claiming historical evidence."""
        calculation_run_id = "synthetic-fdr-2025-26-v1"
        input_id = "synthetic-fdr-input-2025-26-v1"
        calculated_at = "2026-07-27T00:00:00+00:00"
        fixtures = [
            FixtureDifficultyCalculationFixtureInput(
                id="arsenal-gw12",
                team=TeamSummary(id="arsenal", name="Arsenal", short_name="ARS"),
                opponent=TeamSummary(
                    id="man-city",
                    name="Manchester City",
                    short_name="MCI",
                ),
                gameweek=12,
                venue="H",
                attack_difficulty_score=4,
                defence_difficulty_score=3,
            ),
            FixtureDifficultyCalculationFixtureInput(
                id="man-city-gw12",
                team=TeamSummary(
                    id="man-city",
                    name="Manchester City",
                    short_name="MCI",
                ),
                opponent=TeamSummary(id="arsenal", name="Arsenal", short_name="ARS"),
                gameweek=12,
                venue="A",
                attack_difficulty_score=2,
                defence_difficulty_score=4,
            ),
        ]
        input_payload = {
            "season": "2025/26",
            "contract_version": FixtureDifficultyCalculationService.SUPPORTED_CONTRACT_VERSION,
            "algorithm_version": (FixtureDifficultyCalculationService.SUPPORTED_ALGORITHM_VERSION),
            "calculation_run_id": calculation_run_id,
            "source": "deterministic-synthetic-fixture",
            "captured_at": calculated_at,
            "calculated_at": calculated_at,
            "fixture_count": len(fixtures),
            "input_sha256": FixtureDifficultyCalculationService.input_sha256(fixtures),
            "fixtures": [fixture.model_dump(mode="json") for fixture in fixtures],
            "synthetic": True,
        }

        with self._session_factory() as session:
            existing_payload = session.execute(
                select(fdr_calculation_inputs_table.c.payload_json).where(
                    fdr_calculation_inputs_table.c.id == input_id
                )
            ).scalar_one_or_none()
            if existing_payload is None:
                session.execute(
                    insert(fdr_calculation_inputs_table).values(
                        id=input_id,
                        payload_json=input_payload,
                    )
                )
            else:
                if not isinstance(existing_payload, Mapping):
                    raise ValueError("Existing FDR calculation input must be a JSON object.")
                if dict(existing_payload) != input_payload:
                    raise ValueError("Synthetic FDR calculation input conflicts with storage.")
            session.commit()
        return calculation_run_id

    def seed_synthetic_data(self) -> FixtureDifficultyCalculationRunResult:
        """Calculate deterministic synthetic ratings through the server-owned service."""
        calculation_run_id = self.seed_synthetic_calculation_input()
        return FixtureDifficultyCalculationService(self).calculate(
            "2025/26",
            calculation_run_id,
        )
