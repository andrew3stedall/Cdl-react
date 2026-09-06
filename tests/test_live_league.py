from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.league_models import (
    FixtureScore,
    FixtureSquad,
    FixtureSquadPlayer,
    FixtureStatus,
    LeagueFixture,
)
from cdl_api.repositories.live_league import (
    LiveAwarePostgreSQLLeagueRepository,
    LiveAwarePostgreSQLTeamSelectionRepository,
    _event_live_player_minutes,
)
from cdl_api.repositories.postgres_league_fixtures import PostgreSQLLeagueRepository


def _fixture(*, is_current: bool, status: FixtureStatus) -> LeagueFixture:
    return LeagueFixture(
        id="fixture-live",
        gameweek=GameweekSummary(id="gw-3", name="Gameweek 3", number=3),
        home_team=TeamSummary(id="home", name="Home"),
        away_team=TeamSummary(id="away", name="Away"),
        status=status,
        kickoff_label="Gameweek 3",
        round_label="Round 1",
        is_current=is_current,
        score=FixtureScore(),
    )


def test_current_pending_fixture_is_exposed_as_started(monkeypatch) -> None:
    pending = _fixture(is_current=True, status=FixtureStatus.PENDING)
    monkeypatch.setattr(PostgreSQLLeagueRepository, "list_fixtures", lambda self: [pending])
    repository = object.__new__(LiveAwarePostgreSQLLeagueRepository)

    [fixture] = repository.list_fixtures()

    assert fixture.status == FixtureStatus.STARTED


def test_non_current_pending_fixture_stays_pending(monkeypatch) -> None:
    pending = _fixture(is_current=False, status=FixtureStatus.PENDING)
    monkeypatch.setattr(PostgreSQLLeagueRepository, "list_fixtures", lambda self: [pending])
    repository = object.__new__(LiveAwarePostgreSQLLeagueRepository)

    [fixture] = repository.list_fixtures()

    assert fixture.status == FixtureStatus.PENDING


def test_event_live_minutes_and_fixture_state_decorate_players() -> None:
    payload = {
        "elements": [
            {"id": 1, "stats": {"minutes": 90}},
            {"id": 2, "stats": {"minutes": 0}},
        ]
    }
    minutes = _event_live_player_minutes(payload)
    club = TeamSummary(id="epl-ars", name="Arsenal", short_name="ARS")
    players = [
        FixtureSquadPlayer(
            id="fpl-1",
            display_name="Played",
            position="MID",
            club=club,
            points=6,
            slot="starter",
        ),
        FixtureSquadPlayer(
            id="fpl-2",
            display_name="No show",
            position="DEF",
            club=club,
            points=0,
            slot="starter",
        ),
    ]
    squad = FixtureSquad(
        team=TeamSummary(id="home", name="Home"),
        players=players,
        starters=players,
    )

    decorated = LiveAwarePostgreSQLTeamSelectionRepository._decorate_squad(
        squad,
        minutes,
        {"epl-ars": (True, True)},
    )

    assert decorated.starters[0].minutes == 90
    assert decorated.starters[0].has_started_fixture is True
    assert decorated.starters[0].all_fixtures_finished is True
    assert decorated.starters[1].minutes == 0
    assert minutes["fpl-2"] == 0
