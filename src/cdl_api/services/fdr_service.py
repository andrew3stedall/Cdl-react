"""Fixture difficulty ratings service layer."""

from cdl_api.contracts.fdr import (
    FixtureDifficultyCombinedResponse,
    FixtureDifficultyFilters,
    FixtureDifficultyResponse,
    FixtureDifficultyRow,
    FixtureDifficultyScaleStep,
    FixtureDifficultyView,
)
from cdl_api.repositories.fdr_repository import FixtureDifficultyRepository


class FixtureDifficultyService:
    def __init__(self, repository: FixtureDifficultyRepository | None = None) -> None:
        self._repository = repository or FixtureDifficultyRepository()

    def get_combined(
        self,
        filters: FixtureDifficultyFilters | None = None,
    ) -> FixtureDifficultyCombinedResponse:
        active_filters = filters or FixtureDifficultyFilters()
        scales = self.get_scales()
        return FixtureDifficultyCombinedResponse(
            attack=self.get_view(FixtureDifficultyView.ATTACK, active_filters),
            defence=self.get_view(FixtureDifficultyView.DEFENCE, active_filters),
            scales=scales,
        )

    def get_view(
        self,
        view: FixtureDifficultyView,
        filters: FixtureDifficultyFilters | None = None,
    ) -> FixtureDifficultyResponse:
        active_filters = filters or FixtureDifficultyFilters()
        fixtures_by_team = self._repository.list_fixtures(view)
        teams = self._repository.list_teams()
        selected_team_ids = {active_filters.team_id} if active_filters.team_id else {team.id for team in teams}
        available_gameweeks = [
            gameweek
            for gameweek in self._repository.list_gameweeks()
            if active_filters.gameweek_start <= gameweek.number <= active_filters.gameweek_end
        ]
        rows: list[FixtureDifficultyRow] = []

        for team in teams:
            if team.id not in selected_team_ids:
                continue
            fixtures = [
                fixture
                for fixture in fixtures_by_team[team.id]
                if active_filters.gameweek_start <= fixture.gameweek.number <= active_filters.gameweek_end
            ]
            if not fixtures:
                continue
            average_rating = round(
                sum(fixture.rating for fixture in fixtures) / len(fixtures),
                2,
            )
            rows.append(
                FixtureDifficultyRow(
                    team=team,
                    fixtures=fixtures,
                    average_rating=average_rating,
                )
            )

        rows.sort(key=lambda row: (row.average_rating, row.team.name))
        return FixtureDifficultyResponse(
            view=view,
            filters=active_filters,
            scales=self.get_scales(),
            rows=rows,
            available_teams=teams,
            available_gameweeks=available_gameweeks,
        )

    def get_scales(self) -> list[FixtureDifficultyScaleStep]:
        return self._repository.list_scales()
