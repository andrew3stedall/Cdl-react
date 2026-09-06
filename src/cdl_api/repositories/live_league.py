"""Live-aware PostgreSQL league read adapters.

These adapters keep the persisted CDL fixture model authoritative while enriching
current-gameweek reads with official FPL lifecycle and event-live information.
"""

import json
from collections.abc import Mapping

from sqlalchemy import inspect, select
from sqlalchemy.exc import SQLAlchemyError

from cdl_api.contracts.league_models import FixtureSquad, FixtureSquadPlayer, FixtureStatus
from cdl_api.repositories.postgres_fpl_data import (
    external_payload_cache_table,
    fpl_fixtures_table,
)
from cdl_api.repositories.postgres_league_fixtures import PostgreSQLLeagueRepository
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository


class LiveAwarePostgreSQLLeagueRepository(PostgreSQLLeagueRepository):
    """Resolve current CDL fixtures as live once the official FPL GW is current."""

    def list_fixtures(self):  # type: ignore[no-untyped-def]
        fixtures = super().list_fixtures()
        return [
            fixture.model_copy(update={"status": FixtureStatus.STARTED})
            if fixture.is_current and fixture.status == FixtureStatus.PENDING
            else fixture
            for fixture in fixtures
        ]


class LiveAwarePostgreSQLTeamSelectionRepository(PostgreSQLTeamSelectionRepository):
    """Add event minutes and EPL fixture lifecycle to locked gameweek squads."""

    def get_historical_fixture_squads(self, fixture):  # type: ignore[no-untyped-def]
        squads = super().get_historical_fixture_squads(fixture)
        if not squads:
            return squads

        event_minutes, fixture_states = self._live_gameweek_context(fixture.gameweek.number)
        return [self._decorate_squad(squad, event_minutes, fixture_states) for squad in squads]

    def _live_gameweek_context(
        self,
        gameweek_number: int,
    ) -> tuple[dict[str, int], dict[str, tuple[bool, bool]]]:
        with self._session_factory() as session:
            event_payload = session.execute(
                select(external_payload_cache_table.c.payload_json).where(
                    external_payload_cache_table.c.resource == f"event-live:{gameweek_number}"
                )
            ).scalar_one_or_none()
            event_minutes = _event_live_player_minutes(event_payload)

            if not inspect(session.get_bind()).has_table(fpl_fixtures_table.name):
                return event_minutes, {}
            try:
                rows = list(
                    session.execute(
                        select(
                            fpl_fixtures_table.c.home_team_id,
                            fpl_fixtures_table.c.away_team_id,
                            fpl_fixtures_table.c.started,
                            fpl_fixtures_table.c.finished,
                        ).where(fpl_fixtures_table.c.gameweek == gameweek_number)
                    ).mappings()
                )
            except SQLAlchemyError:
                return event_minutes, {}

        by_team: dict[str, list[tuple[bool, bool]]] = {}
        for row in rows:
            state = (bool(row["started"]), bool(row["finished"]))
            by_team.setdefault(str(row["home_team_id"]), []).append(state)
            by_team.setdefault(str(row["away_team_id"]), []).append(state)
        states = {
            team_id: (
                any(started for started, _ in team_states),
                bool(team_states) and all(finished for _, finished in team_states),
            )
            for team_id, team_states in by_team.items()
        }
        return event_minutes, states

    @staticmethod
    def _decorate_squad(
        squad: FixtureSquad,
        event_minutes: Mapping[str, int],
        fixture_states: Mapping[str, tuple[bool, bool]],
    ) -> FixtureSquad:
        def decorate(player: FixtureSquadPlayer) -> FixtureSquadPlayer:
            club_id = player.club.id if player.club is not None else ""
            fixture_state = fixture_states.get(club_id)
            return player.model_copy(
                update={
                    "minutes": _player_event_value(player.id, event_minutes),
                    "has_started_fixture": fixture_state[0] if fixture_state is not None else None,
                    "all_fixtures_finished": fixture_state[1]
                    if fixture_state is not None
                    else None,
                }
            )

        return squad.model_copy(
            update={
                "players": [decorate(player) for player in squad.players],
                "starters": [decorate(player) for player in squad.starters],
                "bench": [decorate(player) for player in squad.bench],
                "reserves": [decorate(player) for player in squad.reserves],
            }
        )


def _event_live_player_minutes(payload: object) -> dict[str, int]:
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            return {}
    if not isinstance(payload, Mapping) or not isinstance(payload.get("elements"), list):
        return {}

    minutes: dict[str, int] = {}
    for element in payload["elements"]:
        if not isinstance(element, Mapping) or element.get("id") is None:
            continue
        stats = element.get("stats")
        if not isinstance(stats, Mapping) or "minutes" not in stats:
            continue
        try:
            value = int(stats.get("minutes", 0) or 0)
        except (TypeError, ValueError):
            continue
        raw_id = str(element["id"])
        minutes[raw_id] = value
        minutes[f"fpl-{raw_id}"] = value
    return minutes


def _player_event_value(player_id: str, values: Mapping[str, int]) -> int | None:
    if player_id in values:
        return values[player_id]
    unprefixed_id = player_id.removeprefix("fpl-")
    return values.get(unprefixed_id)
