from fastapi.testclient import TestClient

from cdl_api.app import create_app
from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.league_models import (
    FixtureOutcome,
    FixtureScore,
    FixtureStatus,
    LeagueFixture,
)
from cdl_api.contracts.squad import PlayerDetail, PlayerNextFixture, PlayerOwnershipStatus
from cdl_api.routers.league import get_fixture_squad_repository, get_league_repository


class MemoryLeagueRepository:
    def __init__(self, fixture: LeagueFixture) -> None:
        self.fixture = fixture

    def get_fixture(self, fixture_id: str) -> LeagueFixture | None:
        return self.fixture if fixture_id == self.fixture.id else None


class MemoryFixtureSquadRepository:
    def __init__(self, players: list[PlayerDetail]) -> None:
        self.players = players

    def list_squad_players(self) -> list[PlayerDetail]:
        return self.players


def _player(team: TeamSummary, index: int, position: str) -> PlayerDetail:
    player_team = TeamSummary(id=f"epl-{index}", name="Club")
    return PlayerDetail(
        id=f"{team.id}-player-{index}",
        display_name=f"{team.name} Player {index}",
        position=position,
        team=player_team,
        epl_team=player_team,
        draft_team=team,
        status=PlayerOwnershipStatus.OWNED,
        next_fixture=PlayerNextFixture(
            fixture_id=f"epl-fixture-{index}",
            opponent=TeamSummary(id="epl-next", name="Next Club", short_name="NXT"),
            difficulty=3,
            is_home=index % 2 == 0,
        ),
    )


def test_upcoming_fixture_returns_both_squads_with_best_valid_xis() -> None:
    home = TeamSummary(id="team-home", name="Home Team")
    away = TeamSummary(id="team-away", name="Away Team")
    fixture = LeagueFixture(
        id="fixture-upcoming",
        gameweek=GameweekSummary(id="gw-1", name="Gameweek 1", number=1),
        home_team=home,
        away_team=away,
        status=FixtureStatus.PENDING,
        kickoff_label="Gameweek 1",
        round_label="Regular season",
        score=FixtureScore(outcome=FixtureOutcome.PENDING),
    )
    positions = [
        "GKP",
        "DEF",
        "DEF",
        "DEF",
        "DEF",
        "MID",
        "MID",
        "MID",
        "MID",
        "FWD",
        "FWD",
        "MID",
    ]
    players = [
        player
        for team in (home, away)
        for index, position in enumerate(positions, 1)
        for player in [_player(team, index, position)]
    ]
    league_repository = MemoryLeagueRepository(fixture)
    squad_repository = MemoryFixtureSquadRepository(players)
    app = create_app()
    app.dependency_overrides[get_league_repository] = lambda: league_repository
    app.dependency_overrides[get_fixture_squad_repository] = lambda: squad_repository

    response = TestClient(app).get("/api/league/fixtures/fixture-upcoming/squads")

    assert response.status_code == 200
    payload = response.json()
    assert [squad["team"]["name"] for squad in payload] == ["Home Team", "Away Team"]
    assert all(len(squad["starters"]) == 11 for squad in payload)
    assert payload[0]["starters"][0]["club"]["name"] == "Club"
    assert payload[0]["starters"][0]["next_opponent"]["short_name"] == "NXT"
    assert payload[0]["starters"][0]["next_fixture_is_home"] is False
    assert payload[0]["starters"][0]["next_fixture_difficulty"] == 3
    assert payload[0]["starters"][0]["is_captain"] is False
    assert all(
        sum(player["position"] == position for player in squad["starters"]) == count
        for squad in payload
        for position, count in {"GKP": 1, "DEF": 4, "MID": 4, "FWD": 2}.items()
    )
