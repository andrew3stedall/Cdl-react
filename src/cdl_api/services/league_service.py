"""League fixture, table, knockout, and head-to-head services."""

from cdl_api.contracts.league_models import (
    FixtureDetailResponse,
    FixtureEvent,
    FixtureOutcome,
    HeadToHeadRecord,
    HeadToHeadResponse,
    KnockoutMatch,
    KnockoutResponse,
    LeagueFixture,
    LeagueFixturesResponse,
    LeagueTableResponse,
    LeagueTableRow,
)
from cdl_api.repositories.league_repository import LeagueRepository


class FixtureService:
    def __init__(self, repository: LeagueRepository | None = None) -> None:
        self._repository = repository or LeagueRepository()

    def list_all(self) -> LeagueFixturesResponse:
        fixtures = self._repository.list_fixtures()
        return LeagueFixturesResponse(gameweek=None, fixtures=fixtures)

    def list_current(self) -> LeagueFixturesResponse:
        fixtures = self._repository.list_current_fixtures()
        gameweek = fixtures[0].gameweek if fixtures else None
        return LeagueFixturesResponse(gameweek=gameweek, fixtures=fixtures)

    def list_next(self) -> LeagueFixturesResponse:
        fixtures = self._repository.list_next_fixtures()
        gameweek = fixtures[0].gameweek if fixtures else None
        return LeagueFixturesResponse(gameweek=gameweek, fixtures=fixtures)

    def get_detail(self, fixture_id: str) -> FixtureDetailResponse | None:
        fixture = self._repository.get_fixture(fixture_id)
        if fixture is None or not fixture.detail_available:
            return None

        events = [
            FixtureEvent(
                label="Bonus points awarded",
                team=fixture.home_team,
                points=fixture.score.bonus_points.get(fixture.home_team.id, 0),
                rule_reference="league-table",
            ),
            FixtureEvent(
                label="Chip impact recorded",
                team=fixture.home_team,
                points=0,
                rule_reference="chip-use",
            ),
        ]
        return FixtureDetailResponse(
            fixture=fixture,
            events=events,
            notes=["Started fixtures expose detail data once scoring is available."],
        )


class LeagueTableService:
    def __init__(self, repository: LeagueRepository | None = None) -> None:
        self._repository = repository or LeagueRepository()

    def get_table(self) -> LeagueTableResponse:
        standings: dict[str, LeagueTableRow] = {}

        for fixture in self._repository.list_fixtures():
            self._ensure_row(standings, fixture)
            if fixture.score.outcome == FixtureOutcome.PENDING:
                continue

            home = standings[fixture.home_team.id]
            away = standings[fixture.away_team.id]
            home_score = fixture.score.home_score or 0
            away_score = fixture.score.away_score or 0
            home.played += 1
            away.played += 1
            home.points_for += home_score
            home.points_against += away_score
            away.points_for += away_score
            away.points_against += home_score

            if fixture.score.outcome == FixtureOutcome.HOME_WIN:
                home.wins += 1
                away.losses += 1
                home.league_points += 3
            elif fixture.score.outcome == FixtureOutcome.AWAY_WIN:
                away.wins += 1
                home.losses += 1
                away.league_points += 3
            else:
                home.draws += 1
                away.draws += 1
                home.league_points += 1
                away.league_points += 1

        rows = sorted(
            standings.values(),
            key=lambda row: (
                row.league_points,
                row.points_for - row.points_against,
                row.points_for,
            ),
            reverse=True,
        )
        for index, row in enumerate(rows, start=1):
            row.position = index
            row.points_difference = row.points_for - row.points_against

        return LeagueTableResponse(rows=rows)

    def _ensure_row(self, standings: dict[str, LeagueTableRow], fixture: LeagueFixture) -> None:
        for team in (fixture.home_team, fixture.away_team):
            standings.setdefault(
                team.id,
                LeagueTableRow(
                    position=0,
                    team=team,
                    played=0,
                    wins=0,
                    draws=0,
                    losses=0,
                    points_for=0,
                    points_against=0,
                    points_difference=0,
                    league_points=0,
                ),
            )


class HeadToHeadService:
    def __init__(self, repository: LeagueRepository | None = None) -> None:
        self._repository = repository or LeagueRepository()

    def get_records(self) -> HeadToHeadResponse:
        records = []
        for fixture in self._repository.list_fixtures():
            if fixture.score.outcome == FixtureOutcome.PENDING:
                continue

            home_score = fixture.score.home_score or 0
            away_score = fixture.score.away_score or 0
            records.append(
                HeadToHeadRecord(
                    team=fixture.home_team,
                    opponent=fixture.away_team,
                    played=1,
                    wins=1 if fixture.score.outcome == FixtureOutcome.HOME_WIN else 0,
                    draws=1 if fixture.score.outcome == FixtureOutcome.DRAW else 0,
                    losses=1 if fixture.score.outcome == FixtureOutcome.AWAY_WIN else 0,
                    points_for=home_score,
                    points_against=away_score,
                )
            )
        return HeadToHeadResponse(records=records)


class KnockoutService:
    def __init__(self, repository: LeagueRepository | None = None) -> None:
        self._repository = repository or LeagueRepository()

    def get_knockout(self) -> KnockoutResponse:
        matches = [
            KnockoutMatch(id=fixture.id, round_label=fixture.round_label, fixture=fixture)
            for fixture in self._repository.list_fixtures()
            if "Final" in fixture.round_label
        ]
        return KnockoutResponse(rounds=["Semi Final", "Final"], matches=matches)
