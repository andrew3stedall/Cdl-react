"""Application service for the context-aware Manager's Desk read model."""

from cdl_api.contracts.league_models import FixtureStatus, LeagueFixture
from cdl_api.contracts.manager_desk import ManagerDeskContext, ManagerDeskResponse
from cdl_api.repositories.league_repository import LeagueRepository
from cdl_api.services.league_service import FixtureService, LeagueReadRepository, LeagueTableService
from cdl_api.services.squad import SquadManagementService
from cdl_api.services.squad_workspace import SquadWorkspaceService
from cdl_api.services.team_selection import TeamSelectionService


class ManagerDeskService:
    """Compose desk data once so the client does not fan out across read APIs."""

    def __init__(
        self,
        team_selection_service: TeamSelectionService,
        squad_service: SquadManagementService,
        league_repository: LeagueReadRepository | None = None,
    ) -> None:
        self._team_selection_service = team_selection_service
        self._squad_service = squad_service
        self._league_repository = league_repository or LeagueRepository()

    def get_desk(self) -> ManagerDeskResponse:
        selection = self._team_selection_service.get_team_selection()
        squad = SquadWorkspaceService(self._squad_service).get_workspace()
        current_fixtures = FixtureService(self._league_repository).list_current().fixtures
        next_fixtures = FixtureService(self._league_repository).list_next().fixtures
        current_fixture = self._manager_fixture(
            current_fixtures,
            selection.manager_team.id,
            selection.manager_team.name,
            fallback=True,
        )
        next_fixture = self._manager_fixture(
            next_fixtures,
            selection.manager_team.id,
            selection.manager_team.name,
            fallback=True,
        )
        recent_fixtures = self._recent_manager_fixtures(
            selection.manager_team.id,
            selection.manager_team.name,
            current_fixture,
        )
        available_players = self._squad_service.get_changes().available_to_add[:3]

        return ManagerDeskResponse(
            context=self._context_for(current_fixture),
            gameweek=selection.gameweek,
            selection=selection,
            squad=squad,
            current_fixture=current_fixture,
            next_fixture=next_fixture,
            current_fixtures=current_fixtures,
            next_fixtures=next_fixtures,
            recent_fixtures=recent_fixtures,
            league_table=LeagueTableService(self._league_repository).get_table(),
            available_players=available_players,
        )

    def _recent_manager_fixtures(
        self,
        team_id: str,
        team_name: str,
        current_fixture: LeagueFixture | None,
    ) -> list[LeagueFixture]:
        fixtures = [
            fixture
            for fixture in self._league_repository.list_fixtures()
            if fixture.status in {FixtureStatus.STARTED, FixtureStatus.COMPLETE}
            and self._contains_team(fixture, team_id, team_name)
        ]
        if not fixtures and current_fixture is not None:
            fixtures = [current_fixture]
        return fixtures[-5:]

    @staticmethod
    def _context_for(fixture: LeagueFixture | None) -> ManagerDeskContext:
        if fixture is None or fixture.status == FixtureStatus.PENDING:
            return ManagerDeskContext.PRE_DEADLINE
        if fixture.status == FixtureStatus.STARTED:
            return ManagerDeskContext.LIVE
        return ManagerDeskContext.FINALISED

    @classmethod
    def _manager_fixture(
        cls,
        fixtures: list[LeagueFixture],
        team_id: str,
        team_name: str,
        *,
        fallback: bool,
    ) -> LeagueFixture | None:
        matching = next(
            (fixture for fixture in fixtures if cls._contains_team(fixture, team_id, team_name)),
            None,
        )
        if matching is not None or not fallback:
            return matching
        return fixtures[0] if fixtures else None

    @staticmethod
    def _contains_team(fixture: LeagueFixture, team_id: str, team_name: str) -> bool:
        return any(
            team.id == team_id or team.name == team_name
            for team in (fixture.home_team, fixture.away_team)
        )
