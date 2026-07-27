"""PostgreSQL-backed fixture difficulty rating reads."""

from collections.abc import Callable, Mapping

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.fdr import (
    FixtureDifficultyBand,
    FixtureDifficultyFixture,
    FixtureDifficultyScaleStep,
    FixtureDifficultyView,
)
from cdl_api.repositories.postgres_dashboard_fdr import fdr_ratings_table


class PostgreSQLFixtureDifficultyRepository:
    """Read FDR results only from persisted migration-0007 payloads."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def _payloads(self) -> list[dict[str, object]]:
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
                payloads.append({"id": str(row["id"]), **dict(payload)})
            return payloads

    def list_teams(self) -> list[TeamSummary]:
        teams: dict[str, TeamSummary] = {}
        for payload in self._payloads():
            for prefix in ("team", "opponent"):
                team_id = str(payload[f"{prefix}_id"])
                teams[team_id] = TeamSummary(
                    id=team_id,
                    name=str(payload[f"{prefix}_name"]),
                    short_name=str(payload[f"{prefix}_short_name"]),
                )
        return sorted(teams.values(), key=lambda team: team.name)

    def list_gameweeks(self) -> list[GameweekSummary]:
        numbers = sorted({int(payload["gameweek"]) for payload in self._payloads()})
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

    def list_fixtures(
        self,
        view: FixtureDifficultyView,
    ) -> dict[str, list[FixtureDifficultyFixture]]:
        fixtures: dict[str, list[FixtureDifficultyFixture]] = {
            team.id: [] for team in self.list_teams()
        }
        for payload in self._payloads():
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
        """Idempotently insert deterministic, explicitly synthetic FDR ratings."""
        rows = (
            ("attack-arsenal-gw12", "attack", "arsenal", "Arsenal", "ARS", "man-city", "Manchester City", "MCI", 12, "H", 4, "hard"),
            ("defence-arsenal-gw12", "defence", "arsenal", "Arsenal", "ARS", "man-city", "Manchester City", "MCI", 12, "H", 3, "medium"),
            ("attack-man-city-gw12", "attack", "man-city", "Manchester City", "MCI", "arsenal", "Arsenal", "ARS", 12, "A", 2, "easy"),
            ("defence-man-city-gw12", "defence", "man-city", "Manchester City", "MCI", "arsenal", "Arsenal", "ARS", 12, "A", 4, "hard"),
        )
        with self._session_factory() as session:
            existing_ids = {str(row[0]) for row in session.execute(select(fdr_ratings_table.c.id))}
            for row in rows:
                rating_id, view, team_id, team_name, team_short, opponent_id, opponent_name, opponent_short, gameweek, venue, rating, band = row
                if rating_id in existing_ids:
                    continue
                session.execute(
                    insert(fdr_ratings_table).values(
                        id=rating_id,
                        payload_json={
                            "season": "2025/26",
                            "view": view,
                            "team_id": team_id,
                            "team_name": team_name,
                            "team_short_name": team_short,
                            "opponent_id": opponent_id,
                            "opponent_name": opponent_name,
                            "opponent_short_name": opponent_short,
                            "gameweek": gameweek,
                            "venue": venue,
                            "rating": rating,
                            "band": band,
                            "synthetic": True,
                        },
                    )
                )
            session.commit()
