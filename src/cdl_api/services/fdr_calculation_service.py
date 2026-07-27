"""Deterministic ownership boundary for persisted FDR calculation runs."""

import hashlib
import json
from typing import Protocol

from cdl_api.contracts.fdr import (
    FixtureDifficultyBand,
    FixtureDifficultyCalculationFixtureInput,
    FixtureDifficultyCalculationInputAudit,
    FixtureDifficultyCalculationRunResult,
    FixtureDifficultyView,
)


class FixtureDifficultyCalculationRepository(Protocol):
    def get_calculation_input_payload(
        self,
        season: str,
        calculation_run_id: str,
    ) -> dict[str, object] | None: ...

    def persist_calculated_ratings(
        self,
        ratings: list[tuple[str, dict[str, object]]],
    ) -> tuple[int, int]: ...


class FixtureDifficultyCalculationService:
    """Validate one versioned input and idempotently persist its ratings."""

    SUPPORTED_CONTRACT_VERSION = "fdr-input/v1"
    SUPPORTED_ALGORITHM_VERSION = "synthetic-baseline/v1"

    def __init__(self, repository: FixtureDifficultyCalculationRepository) -> None:
        self._repository = repository

    def calculate(
        self,
        season: str,
        calculation_run_id: str,
    ) -> FixtureDifficultyCalculationRunResult:
        payload = self._repository.get_calculation_input_payload(
            season,
            calculation_run_id,
        )
        if payload is None:
            raise ValueError("FDR calculation input was not found for the requested season.")

        audit = FixtureDifficultyCalculationInputAudit.model_validate(payload)
        self._validate_audit(audit, season, calculation_run_id)

        raw_fixtures = payload.get("fixtures")
        if not isinstance(raw_fixtures, list):
            raise ValueError("FDR calculation input fixtures must be a JSON array.")
        fixtures = [
            FixtureDifficultyCalculationFixtureInput.model_validate(raw_fixture)
            for raw_fixture in raw_fixtures
        ]
        if len(fixtures) != audit.fixture_count:
            raise ValueError("FDR calculation input fixture count does not match its audit.")

        input_sha256 = self.input_sha256(fixtures)
        if input_sha256 != audit.input_sha256:
            raise ValueError("FDR calculation input digest does not match its audit.")

        ratings = self._calculate_ratings(fixtures, audit)
        created_ratings, unchanged_ratings = self._repository.persist_calculated_ratings(ratings)
        return FixtureDifficultyCalculationRunResult(
            season=season,
            calculation_run_id=calculation_run_id,
            algorithm_version=audit.algorithm_version,
            created_ratings=created_ratings,
            unchanged_ratings=unchanged_ratings,
        )

    @staticmethod
    def input_sha256(
        fixtures: list[FixtureDifficultyCalculationFixtureInput],
    ) -> str:
        canonical_payload = json.dumps(
            [fixture.model_dump(mode="json") for fixture in fixtures],
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        return hashlib.sha256(canonical_payload).hexdigest()

    def _validate_audit(
        self,
        audit: FixtureDifficultyCalculationInputAudit,
        season: str,
        calculation_run_id: str,
    ) -> None:
        if audit.season != season:
            raise ValueError("FDR calculation input season does not match the request.")
        if audit.calculation_run_id != calculation_run_id:
            raise ValueError("FDR calculation run identity does not match the request.")
        if audit.contract_version != self.SUPPORTED_CONTRACT_VERSION:
            raise ValueError("Unsupported FDR calculation input contract version.")
        if audit.algorithm_version != self.SUPPORTED_ALGORITHM_VERSION:
            raise ValueError("Unsupported FDR calculation algorithm version.")

    def _calculate_ratings(
        self,
        fixtures: list[FixtureDifficultyCalculationFixtureInput],
        audit: FixtureDifficultyCalculationInputAudit,
    ) -> list[tuple[str, dict[str, object]]]:
        ratings: list[tuple[str, dict[str, object]]] = []
        for fixture in fixtures:
            scores = (
                (FixtureDifficultyView.ATTACK, fixture.attack_difficulty_score),
                (FixtureDifficultyView.DEFENCE, fixture.defence_difficulty_score),
            )
            for view, score in scores:
                rating = self._rating_for_score(score)
                rating_id = f"{view.value}-{fixture.id}"
                ratings.append(
                    (
                        rating_id,
                        {
                            "season": audit.season,
                            "view": view.value,
                            "team_id": fixture.team.id,
                            "team_name": fixture.team.name,
                            "team_short_name": fixture.team.short_name,
                            "opponent_id": fixture.opponent.id,
                            "opponent_name": fixture.opponent.name,
                            "opponent_short_name": fixture.opponent.short_name,
                            "gameweek": fixture.gameweek,
                            "venue": fixture.venue,
                            "rating": rating,
                            "band": self._band_for_rating(rating).value,
                            "calculation_run_id": audit.calculation_run_id,
                            "algorithm_version": audit.algorithm_version,
                            "calculated_at": audit.calculated_at.isoformat(),
                            "synthetic": audit.synthetic,
                        },
                    )
                )
        return ratings

    @staticmethod
    def _rating_for_score(score: float) -> int:
        return max(1, min(5, int(score + 0.5)))

    @staticmethod
    def _band_for_rating(rating: int) -> FixtureDifficultyBand:
        return {
            1: FixtureDifficultyBand.VERY_EASY,
            2: FixtureDifficultyBand.EASY,
            3: FixtureDifficultyBand.MEDIUM,
            4: FixtureDifficultyBand.HARD,
            5: FixtureDifficultyBand.VERY_HARD,
        }[rating]
