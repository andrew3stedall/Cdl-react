from cdl_api.services.league_service import (
    FixtureService,
    HeadToHeadService,
    KnockoutService,
    LeagueTableService,
)


def test_fixture_service_separates_current_and_next_fixtures() -> None:
    service = FixtureService()

    current = service.list_current()
    upcoming = service.list_next()

    assert current.gameweek is not None
    assert current.gameweek.number == 12
    assert {fixture.id for fixture in current.fixtures} == {"fixture-1201", "fixture-1202"}
    assert upcoming.gameweek is not None
    assert upcoming.gameweek.number == 13
    assert {fixture.id for fixture in upcoming.fixtures} == {"fixture-1301", "fixture-1302"}


def test_fixture_detail_only_returns_started_fixture_details() -> None:
    service = FixtureService()

    detail = service.get_detail("fixture-1201")
    pending_detail = service.get_detail("fixture-1202")

    assert detail is not None
    assert detail.fixture.detail_available is True
    assert any(event.rule_reference == "league-table" for event in detail.events)
    assert pending_detail is None


def test_league_table_service_calculates_standings_from_results() -> None:
    table = LeagueTableService().get_table()

    rows_by_team = {row.team.id: row for row in table.rows}

    assert rows_by_team["castle"].played == 1
    assert rows_by_team["castle"].wins == 1
    assert rows_by_team["castle"].league_points == 3
    assert rows_by_team["castle"].points_difference == 6
    assert table.rows[0].team.id == "castle"


def test_head_to_head_and_knockout_services_expose_context() -> None:
    records = HeadToHeadService().get_records()
    knockout = KnockoutService().get_knockout()

    assert records.records
    assert records.records[0].team.id == "castle"
    assert knockout.rounds == ["Semi Final", "Final"]
    assert {match.round_label for match in knockout.matches} == {"Semi Final"}
