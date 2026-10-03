"""Persist deterministic knockout seeds and project settled tie results."""

from collections.abc import Callable, Mapping

from sqlalchemy import insert, inspect, select, update
from sqlalchemy.orm import Session

from cdl_api.contracts.domain import TeamSummary
from cdl_api.contracts.league_models import (
    KnockoutBracket,
    KnockoutLeg,
    KnockoutTie,
    LeagueFixture,
    LeagueTableResponse,
)
from cdl_api.repositories.postgres_fpl_data import fpl_gameweeks_table
from cdl_api.repositories.postgres_league_fixtures import (
    _table_from_fixtures,
    cdl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
    knockout_matches_table,
    league_table_snapshots_table,
)
from cdl_api.services.knockout_engine import (
    KnockoutLegResult,
    resolve_tie,
    seed_bottom_two,
    seed_top_four,
)


def refresh_knockout_brackets(
    session_factory: Callable[[], Session],
    fixtures: list[LeagueFixture],
    manager_names: dict[str, str],
) -> list[KnockoutBracket]:
    """Seed after final regular GW35, persist known progression, return brackets."""
    with session_factory() as session:
        _seed_from_final_regular_table(session, fixtures)
        fixture_by_id = {fixture.id: fixture for fixture in fixtures}
        results = _payloads_by_fixture(session, fixture_results_table)
        scoring = _payloads_by_fixture(session, fixture_scoring_snapshots_table)
        rows = list(
            session.execute(
                select(knockout_matches_table.c.id, knockout_matches_table.c.payload_json)
            ).all()
        )
        tie_rows = {
            str(payload.get("tie_id")): (str(row_id), payload)
            for row_id, payload in rows
            if isinstance(payload, Mapping) and payload.get("record_type") == "tie"
        }
        _attach_scheduled_fixtures(session, tie_rows)
        tie_rows = {
            str(payload.get("tie_id")): (str(row_id), payload)
            for row_id, payload in session.execute(
                select(knockout_matches_table.c.id, knockout_matches_table.c.payload_json)
            ).all()
            if isinstance(payload, Mapping) and payload.get("record_type") == "tie"
        }
        _materialize_missing_tie_fixtures(session, tie_rows)
        tie_rows = {
            str(payload.get("tie_id")): (str(row_id), payload)
            for row_id, payload in session.execute(
                select(knockout_matches_table.c.id, knockout_matches_table.c.payload_json)
            ).all()
            if isinstance(payload, Mapping) and payload.get("record_type") == "tie"
        }
        _persist_progression(session, tie_rows, fixture_by_id, results, scoring)
        progressed_rows = {
            str(payload.get("tie_id")): (str(row_id), payload)
            for row_id, payload in session.execute(
                select(knockout_matches_table.c.id, knockout_matches_table.c.payload_json)
            ).all()
            if isinstance(payload, Mapping) and payload.get("record_type") == "tie"
        }
        _materialize_missing_tie_fixtures(session, progressed_rows)
        _attach_scheduled_fixtures(session, progressed_rows)
        session.commit()

        rows = list(session.execute(select(knockout_matches_table.c.payload_json)).mappings())
        payloads = [row["payload_json"] for row in rows if isinstance(row["payload_json"], Mapping)]
        return _build_brackets(payloads, fixture_by_id, results, scoring, manager_names)


def _seed_from_final_regular_table(session: Session, fixtures: list[LeagueFixture]) -> None:
    regular_fixtures = [
        fixture
        for fixture in fixtures
        if fixture.round_label.casefold() == "regular season" and fixture.gameweek.number <= 35
    ]
    if not regular_fixtures or not any(
        fixture.gameweek.number == 35 for fixture in regular_fixtures
    ):
        return
    if not inspect(session.get_bind()).has_table(fpl_gameweeks_table.name):
        return
    gw35_finished = session.execute(
        select(fpl_gameweeks_table.c.finished).where(fpl_gameweeks_table.c.id == "35")
    ).scalar_one_or_none()
    if gw35_finished is not True:
        return
    fixture_payloads = _payloads(session, cdl_fixtures_table)
    results = _payloads_by_fixture(session, fixture_results_table)
    regular_ids = {
        str(payload.get("id"))
        for payload in fixture_payloads
        if isinstance(payload.get("gameweek"), Mapping)
        and isinstance(payload["gameweek"].get("number"), int)
        and payload["gameweek"]["number"] <= 35
        and str(payload.get("round_label", "Regular season")).casefold() == "regular season"
        and payload.get("synthetic") is not True
    }
    regular_fixtures = [fixture for fixture in regular_fixtures if fixture.id in regular_ids]
    if not regular_fixtures or not any(
        fixture.gameweek.number == 35 for fixture in regular_fixtures
    ):
        return
    if not regular_ids or not regular_ids <= results.keys():
        return
    if any(
        results[fixture_id].get("finalised") is not True
        or results[fixture_id].get("synthetic") is True
        for fixture_id in regular_ids
    ):
        return
    table = _table_from_fixtures(regular_fixtures)
    if len(table.rows) < 4:
        return
    team_ids = [row.team.id for row in table.rows]
    team_data = {row.team.id: row.team.model_dump(mode="json") for row in table.rows}
    current_payloads = _payloads(session, knockout_matches_table)
    has_schedule = any(
        payload.get("record_type") == "tie" and payload.get("tie_id") == "top-four-semi-1"
        for payload in current_payloads
    )
    if has_schedule:
        return
    table = _official_gw35_table(session, team_ids)
    if table is not None:
        team_ids = [row.team.id for row in sorted(table.rows, key=lambda row: row.position)]
        team_data = {row.team.id: row.team.model_dump(mode="json") for row in table.rows}
    for index, pair in enumerate(seed_top_four(team_ids), start=1):
        _insert_tie(
            session,
            f"top-four-semi-{index}",
            "top-four",
            "Semi Final",
            pair,
            team_data,
            2,
            36,
        )
    _insert_tie(
        session,
        "bottom-two-final",
        "bottom-two",
        "Bottom-two Final",
        seed_bottom_two(team_ids),
        team_data,
        2,
        37,
    )


def _insert_tie(
    session: Session,
    tie_id: str,
    bracket_id: str,
    round_label: str,
    team_ids: tuple[str, str],
    team_data: Mapping[str, Mapping[str, object]],
    expected_legs: int,
    start_gameweek: int,
) -> None:
    session.execute(
        insert(knockout_matches_table).values(
            id=f"bracket-{tie_id}",
            payload_json={
                "record_type": "tie",
                "tie_id": tie_id,
                "bracket_id": bracket_id,
                "round_label": round_label,
                "team_ids": list(team_ids),
                "teams": [team_data[team_id] for team_id in team_ids],
                "expected_legs": expected_legs,
                "start_gameweek": start_gameweek,
                "fixture_ids": [],
                "synthetic": False,
            },
        )
    )


def _official_gw35_table(
    session: Session, regular_team_ids: list[str]
) -> LeagueTableResponse | None:
    allowed_ids = set(regular_team_ids)
    for payload in reversed(_payloads(session, league_table_snapshots_table)):
        if (
            payload.get("mode") != "official"
            or payload.get("gameweek") not in (35, "35")
            or payload.get("calculated_at") is None
            or payload.get("synthetic") is True
        ):
            continue
        table = LeagueTableResponse.model_validate(payload)
        snapshot_ids = {row.team.id for row in table.rows}
        if len(snapshot_ids) >= 4 and snapshot_ids <= allowed_ids:
            return table
    return None


def _persist_progression(
    session: Session,
    ties: dict[str, tuple[str, Mapping[str, object]]],
    fixtures: Mapping[str, LeagueFixture],
    results: Mapping[str, Mapping[str, object]],
    scoring: Mapping[str, Mapping[str, object]],
) -> None:
    if not all(f"top-four-semi-{index}" in ties for index in (1, 2)):
        return
    outcomes = [
        _tie_outcome(ties[f"top-four-semi-{index}"][1], fixtures, results, scoring)
        for index in (1, 2)
    ]
    if not all(outcome is not None for outcome in outcomes):
        return
    first, second = outcomes
    if first is None or second is None:
        return
    teams_data: dict[str, Mapping[str, object]] = {}
    for _, payload in (ties["top-four-semi-1"], ties["top-four-semi-2"]):
        teams_data.update(
            {
                str(team["id"]): team
                for team in payload.get("teams", [])
                if isinstance(team, Mapping)
            }
        )
    for tie_id, label, pair, start_gameweek in (
        ("top-four-final", "Final", (first[0], second[0]), 38),
        ("top-four-third-place", "Third-place Playoff", (first[1], second[1]), 38),
    ):
        if tie_id not in ties:
            _insert_tie(session, tie_id, "top-four", label, pair, teams_data, 1, start_gameweek)


def _attach_scheduled_fixtures(
    session: Session,
    ties: dict[str, tuple[str, Mapping[str, object]]],
) -> None:
    source_payloads = _payloads(session, cdl_fixtures_table)
    synthetic_ids = {
        str(payload.get("id")) for payload in source_payloads if payload.get("synthetic") is True
    }
    synthetic_ids.update(
        fixture_id
        for fixture_id, result in _payloads_by_fixture(session, fixture_results_table).items()
        if result.get("synthetic") is True
    )
    candidates = [
        payload
        for payload in source_payloads
        if isinstance(payload.get("gameweek"), Mapping)
        and isinstance(payload.get("home_team"), Mapping)
        and isinstance(payload.get("away_team"), Mapping)
    ]
    labels = {
        "top-four-semi-1": ("semi",),
        "top-four-semi-2": ("semi",),
        "bottom-two-final": ("final",),
        "top-four-final": ("final",),
        "top-four-third-place": ("third", "3rd"),
    }
    for tie_id, (row_id, payload) in ties.items():
        team_ids = {str(team_id) for team_id in payload.get("team_ids", [])}
        if len(team_ids) != 2:
            continue
        expected_legs = int(payload.get("expected_legs", 0))
        start_gameweek = int(payload.get("start_gameweek", 0))
        allowed_labels = labels.get(tie_id)
        if allowed_labels is None:
            continue
        matching = [
            fixture
            for fixture in candidates
            if str(fixture.get("id")) not in synthetic_ids
            and str(fixture.get("round_label", "")).casefold() != "regular season"
            and start_gameweek
            <= int(fixture["gameweek"].get("number", 0))
            < start_gameweek + expected_legs
            and any(
                label in str(fixture.get("round_label", "")).casefold() for label in allowed_labels
            )
            and {
                str(fixture["home_team"].get("id")),
                str(fixture["away_team"].get("id")),
            }
            == team_ids
        ]
        matching.sort(
            key=lambda fixture: (
                int(fixture["gameweek"].get("number", 0)),
                str(fixture.get("id", "")),
            )
        )
        fixture_ids = [str(fixture.get("id")) for fixture in matching[:expected_legs]]
        if list(payload.get("fixture_ids", [])) == fixture_ids:
            continue
        session.execute(
            update(knockout_matches_table)
            .where(knockout_matches_table.c.id == row_id)
            .values(payload_json={**dict(payload), "fixture_ids": fixture_ids})
        )


def _materialize_missing_tie_fixtures(
    session: Session,
    ties: dict[str, tuple[str, Mapping[str, object]]],
) -> None:
    """Create real pending CDL fixtures for fully unscheduled known ties."""
    existing_fixture_ids = set(session.execute(select(cdl_fixtures_table.c.id)).scalars())
    for tie_id, (_, payload) in ties.items():
        expected_legs = int(payload.get("expected_legs", 0))
        existing_tie_fixtures = payload.get("fixture_ids", [])
        if expected_legs < 1 or existing_tie_fixtures:
            continue
        teams = payload.get("teams", [])
        if len(teams) != 2 or not all(isinstance(team, Mapping) for team in teams):
            continue
        first, second = teams
        start_gameweek = int(payload.get("start_gameweek", 0))
        if start_gameweek < 1:
            continue
        for leg_number in range(1, expected_legs + 1):
            fixture_id = f"knockout-{tie_id}-leg-{leg_number}"
            if fixture_id in existing_fixture_ids:
                continue
            gameweek_number = start_gameweek + leg_number - 1
            home, away = (first, second) if leg_number % 2 == 1 else (second, first)
            session.execute(
                insert(cdl_fixtures_table).values(
                    id=fixture_id,
                    payload_json={
                        "id": fixture_id,
                        "gameweek": {
                            "id": str(gameweek_number),
                            "name": f"Gameweek {gameweek_number}",
                            "number": gameweek_number,
                        },
                        "home_team": home,
                        "away_team": away,
                        "status": "pending",
                        "kickoff_label": f"Gameweek {gameweek_number} {payload['round_label']}",
                        "round_label": payload["round_label"],
                        "is_current": False,
                        "is_next": False,
                        "detail_available": False,
                        "synthetic": False,
                        "score": {"outcome": "pending"},
                    },
                )
            )
            existing_fixture_ids.add(fixture_id)


def _tie_outcome(
    payload: Mapping[str, object],
    fixtures: Mapping[str, LeagueFixture],
    results: Mapping[str, Mapping[str, object]],
    scoring: Mapping[str, Mapping[str, object]],
) -> tuple[str, str] | None:
    team_ids = tuple(str(value) for value in payload.get("team_ids", []))
    if len(team_ids) != 2:
        return None
    legs = _settled_legs(payload, fixtures, results, scoring)
    if len(legs) != int(payload.get("expected_legs", 0)):
        return None
    resolution = resolve_tie((team_ids[0], team_ids[1]), legs)
    if resolution.winner_team_id is None:
        return None
    loser = team_ids[1] if resolution.winner_team_id == team_ids[0] else team_ids[0]
    return resolution.winner_team_id, loser


def _settled_legs(
    payload: Mapping[str, object],
    fixtures: Mapping[str, LeagueFixture],
    results: Mapping[str, Mapping[str, object]],
    scoring: Mapping[str, Mapping[str, object]],
) -> list[KnockoutLegResult]:
    team_ids = {str(value) for value in payload.get("team_ids", [])}
    legs = []
    for fixture_id in payload.get("fixture_ids", []):
        fixture_id = str(fixture_id)
        fixture = fixtures.get(fixture_id)
        result = results.get(fixture_id, {})
        goals = scoring.get(fixture_id, {}).get("scoring_lineup_goals", {})
        if (
            fixture is None
            or result.get("finalised") is not True
            or result.get("synthetic") is True
            or fixture.home_team.id not in team_ids
            or fixture.away_team.id not in team_ids
            or not isinstance(goals, Mapping)
            or fixture.home_team.id not in goals
            or fixture.away_team.id not in goals
        ):
            continue
        home, away = result.get("home_score"), result.get("away_score")
        if home is None or away is None:
            continue
        legs.append(
            KnockoutLegResult(
                fixture.home_team.id,
                fixture.away_team.id,
                int(home),
                int(away),
                int(goals[fixture.home_team.id]),
                int(goals[fixture.away_team.id]),
            )
        )
    return legs


def _build_brackets(
    payloads: list[Mapping[str, object]],
    fixtures: Mapping[str, LeagueFixture],
    results: Mapping[str, Mapping[str, object]],
    scoring: Mapping[str, Mapping[str, object]],
    manager_names: dict[str, str],
) -> list[KnockoutBracket]:
    groups: dict[str, list[KnockoutTie]] = {"top-four": [], "bottom-two": []}
    for payload in payloads:
        if payload.get("record_type") != "tie":
            continue
        bracket_id = str(payload.get("bracket_id", ""))
        if bracket_id not in groups:
            continue
        teams = []
        for team_data in payload.get("teams", []):
            if not isinstance(team_data, Mapping):
                continue
            team_data = dict(team_data)
            manager = manager_names.get(str(team_data.get("id", "")))
            if manager:
                team_data["manager_name"] = manager
            teams.append(TeamSummary.model_validate(team_data))
        team_ids = tuple(team.id for team in teams)
        if len(team_ids) != 2:
            continue
        leg_fixtures = [
            (str(fixture_id), fixtures[str(fixture_id)])
            for fixture_id in payload.get("fixture_ids", [])
            if str(fixture_id) in fixtures
        ]
        leg_fixtures.sort(key=lambda pair: (pair[1].gameweek.number, pair[0]))
        settled = _settled_legs(payload, fixtures, results, scoring)
        expected = int(payload.get("expected_legs", 0))
        status = "pending"
        aggregate: dict[str, int] = {}
        goals: dict[str, int] = {}
        winner = None
        if settled:
            resolution = resolve_tie((team_ids[0], team_ids[1]), settled)
            aggregate = dict(resolution.aggregate)
            goals = dict(resolution.scoring_lineup_goals)
            if len(settled) < expected:
                status = "in_progress"
            else:
                status = resolution.status
                winner = next(
                    (team for team in teams if team.id == resolution.winner_team_id),
                    None,
                )
        legs = [
            KnockoutLeg(id=fixture_id, leg_number=index, fixture=fixture)
            for index, (fixture_id, fixture) in enumerate(leg_fixtures, start=1)
        ]
        groups[bracket_id].append(
            KnockoutTie(
                id=str(payload.get("tie_id", "")),
                round_label=str(payload.get("round_label", "")),
                teams=teams,
                legs=legs,
                expected_legs=expected,
                start_gameweek=(
                    int(payload["start_gameweek"])
                    if payload.get("start_gameweek") is not None
                    else None
                ),
                aggregate=aggregate,
                scoring_lineup_goals=goals,
                winner=winner,
                tiebreak_status=status,
            )
        )
    brackets = []
    for bracket_id, label in (("top-four", "Top four"), ("bottom-two", "Bottom two")):
        ties = groups[bracket_id]
        if not ties:
            continue
        complete = all(tie.winner is not None for tie in ties)
        unresolved = any(tie.tiebreak_status.startswith("unresolved") for tie in ties)
        brackets.append(
            KnockoutBracket(
                id=bracket_id,
                label=label,
                status="complete" if complete else "unresolved" if unresolved else "in_progress",
                ties=ties,
            )
        )
    return brackets


def _payloads(session: Session, table: object) -> list[Mapping[str, object]]:
    return [
        row["payload_json"]
        for row in session.execute(select(table.c.payload_json)).mappings()
        if isinstance(row["payload_json"], Mapping)
    ]


def _payloads_by_fixture(session: Session, table: object) -> dict[str, Mapping[str, object]]:
    return {
        str(payload["fixture_id"]): payload
        for payload in _payloads(session, table)
        if payload.get("fixture_id") is not None
    }
