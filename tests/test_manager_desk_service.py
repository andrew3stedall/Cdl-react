from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.league_models import FixtureScore, FixtureStatus, LeagueFixture
from cdl_api.services.manager_desk import ManagerDeskService


class MemoryLeagueRepository:
    def __init__(self, fixtures: list[LeagueFixture]) -> None:
        self.fixtures = fixtures

    def list_fixtures(self) -> list[LeagueFixture]:
        return self.fixtures


def test_form_window_includes_five_prior_gameweeks_plus_live_gameweek() -> None:
    fixtures = [
        LeagueFixture(
            id=f"fixture-{number}",
            gameweek=GameweekSummary(id=f"gw-{number}", name=f"Gameweek {number}", number=number),
            home_team=TeamSummary(id="home", name="Home"),
            away_team=TeamSummary(id="away", name="Away"),
            status=FixtureStatus.STARTED if number == 7 else FixtureStatus.COMPLETE,
            kickoff_label=f"GW{number}",
            round_label="Regular season",
            score=FixtureScore(home_score=number, away_score=number - 1),
        )
        for number in range(1, 8)
    ]
    service = object.__new__(ManagerDeskService)
    service._league_repository = MemoryLeagueRepository(fixtures)

    result = service._recent_fixtures()

    assert [fixture.gameweek.number for fixture in result] == [2, 3, 4, 5, 6, 7]
