"""In-memory league data repository for the modern API foundation."""

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.league_models import (
    FixtureOutcome,
    FixtureScore,
    FixtureStatus,
    LeagueFixture,
)


class LeagueRepository:
    def __init__(self) -> None:
        self._teams = {
            "castle": TeamSummary(id="castle", name="Castle United", short_name="CAS"),
            "drafton": TeamSummary(id="drafton", name="Drafton Rovers", short_name="DRA"),
            "keepers": TeamSummary(id="keepers", name="Keeper City", short_name="KPR"),
            "wildcards": TeamSummary(id="wildcards", name="Wildcard Athletic", short_name="WCA"),
        }
        self._gameweeks = {
            "gw-12": GameweekSummary(id="gw-12", name="Gameweek 12", number=12),
            "gw-13": GameweekSummary(id="gw-13", name="Gameweek 13", number=13),
            "sf": GameweekSummary(id="sf", name="Semi Finals", number=99),
        }
        self._fixtures = [
            LeagueFixture(
                id="fixture-1201",
                gameweek=self._gameweeks["gw-12"],
                home_team=self._teams["castle"],
                away_team=self._teams["drafton"],
                status=FixtureStatus.STARTED,
                kickoff_label="GW12 live",
                round_label="Regular season",
                is_current=True,
                detail_available=True,
                score=FixtureScore(
                    home_score=58,
                    away_score=52,
                    bonus_points={"castle": 3, "drafton": 1},
                    chips_played={"castle": ["Triple Captain"], "drafton": []},
                    outcome=FixtureOutcome.HOME_WIN,
                ),
            ),
            LeagueFixture(
                id="fixture-1202",
                gameweek=self._gameweeks["gw-12"],
                home_team=self._teams["keepers"],
                away_team=self._teams["wildcards"],
                status=FixtureStatus.PENDING,
                kickoff_label="GW12 pending",
                round_label="Regular season",
                is_current=True,
            ),
            LeagueFixture(
                id="fixture-1301",
                gameweek=self._gameweeks["gw-13"],
                home_team=self._teams["drafton"],
                away_team=self._teams["keepers"],
                status=FixtureStatus.PENDING,
                kickoff_label="GW13",
                round_label="Regular season",
                is_next=True,
            ),
            LeagueFixture(
                id="fixture-1302",
                gameweek=self._gameweeks["gw-13"],
                home_team=self._teams["wildcards"],
                away_team=self._teams["castle"],
                status=FixtureStatus.PENDING,
                kickoff_label="GW13",
                round_label="Regular season",
                is_next=True,
            ),
            LeagueFixture(
                id="fixture-sf-01",
                gameweek=self._gameweeks["sf"],
                home_team=self._teams["castle"],
                away_team=self._teams["keepers"],
                status=FixtureStatus.PENDING,
                kickoff_label="Playoff semi-final",
                round_label="Semi Final",
            ),
        ]

    def list_fixtures(self) -> list[LeagueFixture]:
        return list(self._fixtures)

    def get_fixture(self, fixture_id: str) -> LeagueFixture | None:
        return next((fixture for fixture in self._fixtures if fixture.id == fixture_id), None)

    def list_current_fixtures(self) -> list[LeagueFixture]:
        return [fixture for fixture in self._fixtures if fixture.is_current]

    def list_next_fixtures(self) -> list[LeagueFixture]:
        return [fixture for fixture in self._fixtures if fixture.is_next]
