"""PostgreSQL-backed fixture difficulty rating reads."""

import hashlib
from collections.abc import Callable, Mapping

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.fdr import (
    FixtureDifficultyBand,
    FixtureDifficultyCalculationInputAudit,
    FixtureDifficultyFixture,
    FixtureDifficultyScaleStep,
    FixtureDifficultyView,
)
from cdl_api.repositories.postgres_dashboard_fdr import (
    fdr_calculation_inputs_table,
    fdr_ratings_table,
)


class PostgreSQLFixtureDifficultyRepository:
    """Read FDR results only from persisted migration-0007 payloads."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def _payloads(self, season: str) -> list[dict[str, object]]:
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

    def seed_synthetic_data(self) -> None:
        """Idempotently insert deterministic, explicitly synthetic FDR evidence."""
        calculation_run_id = "synthetic-fdr-2025-26-v1"
        input_id = "synthetic-fdr-input-2025-26-v1"
        input_payload = {
            "season": "2025/26",
            "contract_version": "fdr-input/v1",
            "algorithm_version": "synthetic-baseline/v1",
            "calculation_run_id": calculation_run_id,
            "source": "deterministic-synthetic-fixture",
            "captured_at": "2026-07-27T00:00:00+00:00",
            "fixture_count": 2,
            "input_sha256": hashlib.sha256(
                b"cdl-react:synthetic-fdr-input:2025-26:v1"
            ).hexdigest(),
            "synthetic": True,
        }
        rows = (
            self._synthetic_rating(
                rating_id="attack-arsenal-gw12",
                view="attack",
                team_id="arsenal",
                team_name="Arsenal",
                team_short_name="ARS",
                opponent_id="man-city",
                opponent_name="Manchester City",
                opponent_short_name="MCI",
                venue="H",
                rating=4,
                band="hard",
                calculation_run_id=calculation_run_id,
            ),
            self._synthetic_rating(
                rating_id="defence-arsenal-gw12",
                view="defence",
                team_id="arsenal",
                team_name="Arsenal",
                team_short_name="ARS",
                opponent_id="man-city",
                opponent_name="Manchester City",
                opponent_short_name="MCI",
                venue="H",
                rating=3,
                band="medium",
                calculation_run_id=calculation_run_id,
            ),
            self._synthetic_rating(
                rating_id="attack-man-city-gw12",
                view="attack",
                team_id="man-city",
                team_name="Manchester City",
                team_short_name="MCI",
                opponent_id="arsenal",
                opponent_name="Arsenal",
                opponent_short_name="ARS",
                venue="A",
                rating=2,
                band="easy",
                calculation_run_id=calculation_run_id,
            ),
            self._synthetic_rating(
                rating_id="defence-man-city-gw12",
                view="defence",
                team_id="man-city",
                team_name="Manchester City",
                team_short_name="MCI",
                opponent_id="arsenal",
                opponent_name="Arsenal",
                opponent_short_name="ARS",
                venue="A",
                rating=4,
                band="hard",
                calculation_run_id=calculation_run_id,
            ),
        )
        with self._session_factory() as session:
            existing_input_ids = {
                str(row[0]) for row in session.execute(select(fdr_calculation_inputs_table.c.id))
            }
            if input_id not in existing_input_ids:
                session.execute(
                    insert(fdr_calculation_inputs_table).values(
                        id=input_id,
                        payload_json=input_payload,
                    )
                )

            existing_rating_ids: set[str] = set()
            for row in session.execute(select(fdr_ratings_table.c.id)):
                existing_rating_ids.add(str(row[0]))
            for rating_id, payload in rows:
                if rating_id in existing_rating_ids:
                    continue
                session.execute(
                    insert(fdr_ratings_table).values(id=rating_id, payload_json=payload)
                )
            session.commit()

    @staticmethod
    def _synthetic_rating(
        rating_id: str,
        view: str,
        team_id: str,
        team_name: str,
        team_short_name: str,
        opponent_id: str,
        opponent_name: str,
        opponent_short_name: str,
        venue: str,
        rating: int,
        band: str,
        calculation_run_id: str,
    ) -> tuple[str, dict[str, object]]:
        return rating_id, {
            "season": "2025/26",
            "view": view,
            "team_id": team_id,
            "team_name": team_name,
            "team_short_name": team_short_name,
            "opponent_id": opponent_id,
            "opponent_name": opponent_name,
            "opponent_short_name": opponent_short_name,
            "gameweek": 12,
            "venue": venue,
            "rating": rating,
            "band": band,
            "calculation_run_id": calculation_run_id,
            "algorithm_version": "synthetic-baseline/v1",
            "calculated_at": "2026-07-27T00:00:00+00:00",
            "synthetic": True,
        }
