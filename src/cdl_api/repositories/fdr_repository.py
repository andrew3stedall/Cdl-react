"""In-memory fixture difficulty ratings repository."""

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.fdr import (
    FixtureDifficultyBand,
    FixtureDifficultyFixture,
    FixtureDifficultyScaleStep,
    FixtureDifficultyView,
)


class FixtureDifficultyRepository:
    """Repository boundary for FDR source data and scale definitions."""

    def list_teams(self) -> list[TeamSummary]:
        return [
            TeamSummary(id="arsenal", name="Arsenal", short_name="ARS"),
            TeamSummary(id="man-city", name="Manchester City", short_name="MCI"),
            TeamSummary(id="liverpool", name="Liverpool", short_name="LIV"),
            TeamSummary(id="tottenham", name="Tottenham", short_name="TOT"),
        ]

    def list_gameweeks(self) -> list[GameweekSummary]:
        return [
            GameweekSummary(id=f"gw-{number}", name=f"Gameweek {number}", number=number)
            for number in range(12, 17)
        ]

    def list_scales(self) -> list[FixtureDifficultyScaleStep]:
        return [
            FixtureDifficultyScaleStep(
                rating=1,
                band=FixtureDifficultyBand.VERY_EASY,
                label="Very easy",
                foreground_token="fdr-1-foreground",
                background_token="fdr-1-background",
                contrast_ratio=7.8,
            ),
            FixtureDifficultyScaleStep(
                rating=2,
                band=FixtureDifficultyBand.EASY,
                label="Easy",
                foreground_token="fdr-2-foreground",
                background_token="fdr-2-background",
                contrast_ratio=6.9,
            ),
            FixtureDifficultyScaleStep(
                rating=3,
                band=FixtureDifficultyBand.MEDIUM,
                label="Medium",
                foreground_token="fdr-3-foreground",
                background_token="fdr-3-background",
                contrast_ratio=5.4,
            ),
            FixtureDifficultyScaleStep(
                rating=4,
                band=FixtureDifficultyBand.HARD,
                label="Hard",
                foreground_token="fdr-4-foreground",
                background_token="fdr-4-background",
                contrast_ratio=6.1,
            ),
            FixtureDifficultyScaleStep(
                rating=5,
                band=FixtureDifficultyBand.VERY_HARD,
                label="Very hard",
                foreground_token="fdr-5-foreground",
                background_token="fdr-5-background",
                contrast_ratio=7.2,
            ),
        ]

    def list_fixtures(
        self,
        view: FixtureDifficultyView,
    ) -> dict[str, list[FixtureDifficultyFixture]]:
        teams = {team.id: team for team in self.list_teams()}
        gameweeks = {gameweek.number: gameweek for gameweek in self.list_gameweeks()}
        ratings = self._ratings()[view]
        opponents = self._opponents()

        return {
            team_id: [
                FixtureDifficultyFixture(
                    id=f"{view.value}-{team_id}-{gameweek_number}",
                    opponent=teams[opponents[team_id][gameweek_number]],
                    gameweek=gameweeks[gameweek_number],
                    venue="H" if index % 2 == 0 else "A",
                    rating=rating,
                    band=self._band_for_rating(rating),
                    abbreviation=self._fixture_abbreviation(
                        teams[opponents[team_id][gameweek_number]],
                        "H" if index % 2 == 0 else "A",
                    ),
                )
                for index, (gameweek_number, rating) in enumerate(team_ratings.items())
            ]
            for team_id, team_ratings in ratings.items()
        }

    def _ratings(self) -> dict[FixtureDifficultyView, dict[str, dict[int, int]]]:
        return {
            FixtureDifficultyView.ATTACK: {
                "arsenal": {12: 2, 13: 3, 14: 4, 15: 2, 16: 5},
                "man-city": {12: 1, 13: 2, 14: 3, 15: 4, 16: 3},
                "liverpool": {12: 3, 13: 4, 14: 2, 15: 3, 16: 2},
                "tottenham": {12: 4, 13: 3, 14: 5, 15: 2, 16: 1},
            },
            FixtureDifficultyView.DEFENCE: {
                "arsenal": {12: 3, 13: 2, 14: 5, 15: 3, 16: 4},
                "man-city": {12: 2, 13: 1, 14: 3, 15: 5, 16: 4},
                "liverpool": {12: 4, 13: 3, 14: 2, 15: 4, 16: 3},
                "tottenham": {12: 5, 13: 4, 14: 3, 15: 2, 16: 2},
            },
        }

    def _opponents(self) -> dict[str, dict[int, str]]:
        return {
            "arsenal": {
                12: "tottenham",
                13: "liverpool",
                14: "man-city",
                15: "tottenham",
                16: "man-city",
            },
            "man-city": {
                12: "liverpool",
                13: "tottenham",
                14: "arsenal",
                15: "liverpool",
                16: "tottenham",
            },
            "liverpool": {
                12: "man-city",
                13: "arsenal",
                14: "tottenham",
                15: "man-city",
                16: "arsenal",
            },
            "tottenham": {
                12: "arsenal",
                13: "man-city",
                14: "liverpool",
                15: "arsenal",
                16: "liverpool",
            },
        }

    def _band_for_rating(self, rating: int) -> FixtureDifficultyBand:
        return {
            1: FixtureDifficultyBand.VERY_EASY,
            2: FixtureDifficultyBand.EASY,
            3: FixtureDifficultyBand.MEDIUM,
            4: FixtureDifficultyBand.HARD,
            5: FixtureDifficultyBand.VERY_HARD,
        }[rating]

    def _fixture_abbreviation(self, opponent: TeamSummary, venue: str) -> str:
        return f"{opponent.short_name or opponent.name} ({venue})"
