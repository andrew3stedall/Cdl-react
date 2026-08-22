"""PostgreSQL persistence for official Fantasy Premier League cache data."""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    func,
    insert,
    or_,
    select,
    update,
)
from sqlalchemy.orm import Session

from cdl_api.contracts.fpl_data import (
    FplCacheStatusResponse,
    FplOpponentDefensiveHistory,
    FplOpponentDefensiveHistoryGroup,
    FplPlayerHistoryResponse,
    FplRefreshResource,
    FplResourceRefreshResult,
    FplResourceStatus,
)
from cdl_api.repositories.postgres_league_fpl import (
    epl_teams_table,
    fpl_cache_freshness_table,
    fpl_player_availability_table,
    fpl_player_values_table,
    fpl_players_table,
    fpl_positions_table,
)

metadata = MetaData()

fpl_gameweeks_table = Table(
    "fpl_gameweeks",
    metadata,
    Column("id", String(16), primary_key=True),
    Column("name", String(64), nullable=False),
    Column("deadline_time", DateTime(timezone=True), nullable=True),
    Column("is_previous", Boolean(), nullable=False),
    Column("is_current", Boolean(), nullable=False),
    Column("is_next", Boolean(), nullable=False),
    Column("finished", Boolean(), nullable=False),
    Column("data_checked", Boolean(), nullable=False),
)

fpl_fixtures_table = Table(
    "fpl_fixtures",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("gameweek", Integer(), nullable=True),
    Column("home_team_id", String(64), nullable=False),
    Column("away_team_id", String(64), nullable=False),
    Column("kickoff_time", DateTime(timezone=True), nullable=True),
    Column("started", Boolean(), nullable=False),
    Column("finished", Boolean(), nullable=False),
    Column("home_difficulty", Integer(), nullable=True),
    Column("away_difficulty", Integer(), nullable=True),
    Column("home_score", Integer(), nullable=True),
    Column("away_score", Integer(), nullable=True),
    Column("payload_json", JSON(), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

fpl_player_current_metrics_table = Table(
    "fpl_player_current_metrics",
    metadata,
    Column("player_id", String(64), primary_key=True),
    Column("total_points", Integer(), nullable=False),
    Column("form", Float(), nullable=False),
    Column("selected_by_percent", Float(), nullable=False),
    Column("minutes", Integer(), nullable=False),
    Column("goals_scored", Integer(), nullable=False),
    Column("assists", Integer(), nullable=False),
    Column("clean_sheets", Integer(), nullable=False),
    Column("expected_goals", Float(), nullable=False),
    Column("expected_assists", Float(), nullable=False),
    Column("chance_of_playing_next_round", Integer(), nullable=True),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

external_payload_cache_table = Table(
    "external_payload_cache",
    metadata,
    Column("resource", String(128), primary_key=True),
    Column("endpoint", String(512), nullable=False),
    Column("payload_json", JSON(), nullable=False),
    Column("response_sha256", String(64), nullable=False),
    Column("fetched_at", DateTime(timezone=True), nullable=False),
)

external_fetch_log_table = Table(
    "external_fetch_log",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("resource", String(128), nullable=False),
    Column("endpoint", String(512), nullable=False),
    Column("status_code", Integer(), nullable=True),
    Column("response_sha256", String(64), nullable=True),
    Column("record_count", Integer(), nullable=False),
    Column("error", String(512), nullable=True),
    Column("fetched_at", DateTime(timezone=True), nullable=False),
)

FPL_INGESTION_TABLES = (
    fpl_gameweeks_table,
    fpl_fixtures_table,
    fpl_player_current_metrics_table,
    external_payload_cache_table,
    external_fetch_log_table,
)


class InvalidFplPayloadError(ValueError):
    """Raised when an FPL payload cannot satisfy the normalized cache contract."""


class PostgreSQLFplDataRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def persist_bootstrap_static(
        self,
        payload: Mapping[str, object],
        *,
        endpoint: str,
        status_code: int,
        response_sha256: str,
        fetched_at: datetime,
    ) -> FplResourceRefreshResult:
        events = _list_of_mappings(payload, "events")
        teams = _list_of_mappings(payload, "teams")
        elements = _list_of_mappings(payload, "elements")
        element_types = _list_of_mappings(payload, "element_types")
        current_gameweek = _active_gameweek(events)

        position_ids = {
            _required_int(row, "id"): str(
                row.get("singular_name_short") or _required_int(row, "id")
            )
            for row in element_types
        }
        position_rows = [
            {
                "id": position_ids[_required_int(row, "id")],
                "singular_name": _required_text(row, "singular_name"),
                "plural_name": _required_text(row, "plural_name"),
            }
            for row in element_types
        ]
        team_rows = [
            {
                "id": str(_required_int(row, "id")),
                "short_name": _required_text(row, "short_name"),
                "name": _required_text(row, "name"),
            }
            for row in teams
        ]
        gameweek_rows = [
            {
                "id": str(_required_int(row, "id")),
                "name": _required_text(row, "name"),
                "deadline_time": _optional_datetime(row.get("deadline_time")),
                "is_previous": bool(row.get("is_previous", False)),
                "is_current": bool(row.get("is_current", False)),
                "is_next": bool(row.get("is_next", False)),
                "finished": bool(row.get("finished", False)),
                "data_checked": bool(row.get("data_checked", False)),
            }
            for row in events
        ]
        player_rows = [
            {
                "id": _player_id(row),
                "first_name": _required_text(row, "first_name"),
                "second_name": _required_text(row, "second_name"),
                "web_name": _required_text(row, "web_name"),
                "position_id": _position_id(row, position_ids),
                "team_id": str(_required_int(row, "team")),
            }
            for row in elements
        ]
        value_rows = [
            {
                "id": f"{_player_id(row)}:{current_gameweek}",
                "player_id": _player_id(row),
                "gameweek": current_gameweek,
                "value": _required_int(row, "now_cost"),
            }
            for row in elements
        ]
        availability_rows = [
            {
                "id": _player_id(row),
                "player_id": _player_id(row),
                "status": _required_text(row, "status"),
                "news": str(row.get("news") or "")[:512],
            }
            for row in elements
        ]
        metric_rows = [
            {
                "player_id": _player_id(row),
                "total_points": _optional_int(row.get("total_points")) or 0,
                "form": _optional_float(row.get("form")) or 0.0,
                "selected_by_percent": _optional_float(row.get("selected_by_percent")) or 0.0,
                "minutes": _optional_int(row.get("minutes")) or 0,
                "goals_scored": _optional_int(row.get("goals_scored")) or 0,
                "assists": _optional_int(row.get("assists")) or 0,
                "clean_sheets": _optional_int(row.get("clean_sheets")) or 0,
                "expected_goals": _optional_float(row.get("expected_goals")) or 0.0,
                "expected_assists": _optional_float(row.get("expected_assists")) or 0.0,
                "chance_of_playing_next_round": _optional_int(
                    row.get("chance_of_playing_next_round")
                ),
                "updated_at": fetched_at,
            }
            for row in elements
        ]

        with self._session_factory() as session:
            _upsert_many(session, fpl_positions_table, position_rows)
            _upsert_many(session, epl_teams_table, team_rows)
            _upsert_many(session, fpl_gameweeks_table, gameweek_rows)
            _upsert_many(session, fpl_players_table, player_rows)
            _upsert_many(session, fpl_player_values_table, value_rows)
            _upsert_many(session, fpl_player_availability_table, availability_rows)
            _upsert_many(session, fpl_player_current_metrics_table, metric_rows)
            self._record_success(
                session,
                resource=FplRefreshResource.BOOTSTRAP_STATIC,
                endpoint=endpoint,
                status_code=status_code,
                response_sha256=response_sha256,
                payload=dict(payload),
                fetched_at=fetched_at,
                record_count=len(elements),
            )
            session.commit()

        return FplResourceRefreshResult(
            resource=FplRefreshResource.BOOTSTRAP_STATIC,
            endpoint=endpoint,
            fetched_at=fetched_at,
            response_sha256=response_sha256,
            records_upserted={
                "gameweeks": len(gameweek_rows),
                "positions": len(position_rows),
                "teams": len(team_rows),
                "players": len(player_rows),
                "player_values": len(value_rows),
                "player_availability": len(availability_rows),
                "player_metrics": len(metric_rows),
            },
        )

    def persist_fixtures(
        self,
        payload: list[Mapping[str, object]],
        *,
        endpoint: str,
        status_code: int,
        response_sha256: str,
        fetched_at: datetime,
    ) -> FplResourceRefreshResult:
        fixture_rows = [
            {
                "id": str(_required_int(row, "id")),
                "gameweek": _optional_int(row.get("event")),
                "home_team_id": str(_required_int(row, "team_h")),
                "away_team_id": str(_required_int(row, "team_a")),
                "kickoff_time": _optional_datetime(row.get("kickoff_time")),
                "started": bool(row.get("started", False)),
                "finished": bool(row.get("finished", False)),
                "home_difficulty": _optional_int(row.get("team_h_difficulty")),
                "away_difficulty": _optional_int(row.get("team_a_difficulty")),
                "home_score": _optional_int(row.get("team_h_score")),
                "away_score": _optional_int(row.get("team_a_score")),
                "payload_json": dict(row),
                "updated_at": fetched_at,
            }
            for row in payload
        ]

        with self._session_factory() as session:
            _upsert_many(session, fpl_fixtures_table, fixture_rows)
            self._record_success(
                session,
                resource=FplRefreshResource.FIXTURES,
                endpoint=endpoint,
                status_code=status_code,
                response_sha256=response_sha256,
                payload=[dict(row) for row in payload],
                fetched_at=fetched_at,
                record_count=len(fixture_rows),
            )
            session.commit()

        return FplResourceRefreshResult(
            resource=FplRefreshResource.FIXTURES,
            endpoint=endpoint,
            fetched_at=fetched_at,
            response_sha256=response_sha256,
            records_upserted={"fixtures": len(fixture_rows)},
        )

    def persist_element_summary(
        self,
        player_id: str,
        payload: Mapping[str, object],
        *,
        endpoint: str,
        status_code: int,
        response_sha256: str,
        fetched_at: datetime,
    ) -> None:
        history = _list_of_mappings(payload, "history")
        fixtures = _list_of_mappings(payload, "fixtures")
        resource = f"element-summary:{player_id}"
        with self._session_factory() as session:
            self._record_success(
                session,
                resource=resource,
                endpoint=endpoint,
                status_code=status_code,
                response_sha256=response_sha256,
                payload=dict(payload),
                fetched_at=fetched_at,
                record_count=len(history) + len(fixtures),
            )
            session.commit()

    def cached_payload(
        self,
        resource: str,
    ) -> tuple[object, datetime, str] | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(
                        external_payload_cache_table.c.payload_json,
                        external_payload_cache_table.c.fetched_at,
                        external_payload_cache_table.c.response_sha256,
                    ).where(external_payload_cache_table.c.resource == resource)
                )
                .mappings()
                .first()
            )
        if row is None:
            return None
        return row["payload_json"], row["fetched_at"], str(row["response_sha256"])

    def enrich_player_history(
        self,
        response: FplPlayerHistoryResponse,
    ) -> FplPlayerHistoryResponse:
        """Join cached fixture metadata without issuing another upstream request."""
        fixture_ids = {str(row.fixture_id) for row in [*response.history, *response.fixtures]}
        if not fixture_ids:
            return response

        with self._session_factory() as session:
            context_rows = self._fixture_rows(session, fixture_ids=fixture_ids)
            contexts = {str(row["fixture_id"]): row for row in context_rows}

            history = [
                row.model_copy(update=_player_fixture_enrichment(row, contexts))
                for row in response.history
            ]
            fixtures = [
                row.model_copy(update=_upcoming_fixture_enrichment(row, contexts))
                for row in response.fixtures
            ]

            next_fixtures = _next_gameweek_fixtures(fixtures)
            defensive_histories = []
            for next_fixture in next_fixtures:
                target_team_id = str(next_fixture.opponent_team_id)
                defensive_rows = self._fixture_rows(
                    session,
                    team_id=target_team_id,
                    finished_only=True,
                    limit=10,
                )
                defensive_history = list(
                    reversed(
                        [
                            _defensive_history_from_fixture(row, target_team_id)
                            for row in defensive_rows
                        ]
                    )
                )
                defensive_histories.append(
                    FplOpponentDefensiveHistoryGroup(
                        opponent_team_id=next_fixture.opponent_team_id,
                        opponent_name=next_fixture.opponent_name,
                        opponent_short_name=next_fixture.opponent_short_name,
                        fixtures=defensive_history,
                    )
                )

        return response.model_copy(
            update={
                "history": history,
                "fixtures": fixtures,
                "opponent_defensive_history": (
                    defensive_histories[0].fixtures if defensive_histories else []
                ),
                "opponent_defensive_histories": defensive_histories,
            }
        )

    @staticmethod
    def _fixture_rows(
        session: Session,
        *,
        fixture_ids: set[str] | None = None,
        team_id: str | None = None,
        finished_only: bool = False,
        limit: int | None = None,
    ) -> list[Mapping[str, object]]:
        home_team = epl_teams_table.alias("history_home_team")
        away_team = epl_teams_table.alias("history_away_team")
        statement = (
            select(
                fpl_fixtures_table.c.id.label("fixture_id"),
                fpl_fixtures_table.c.gameweek,
                fpl_fixtures_table.c.home_team_id,
                fpl_fixtures_table.c.away_team_id,
                fpl_fixtures_table.c.home_difficulty,
                fpl_fixtures_table.c.away_difficulty,
                fpl_fixtures_table.c.kickoff_time,
                fpl_fixtures_table.c.payload_json,
                home_team.c.name.label("home_team_name"),
                home_team.c.short_name.label("home_team_short_name"),
                away_team.c.name.label("away_team_name"),
                away_team.c.short_name.label("away_team_short_name"),
            )
            .join(home_team, fpl_fixtures_table.c.home_team_id == home_team.c.id)
            .join(away_team, fpl_fixtures_table.c.away_team_id == away_team.c.id)
        )
        conditions = []
        if fixture_ids:
            conditions.append(fpl_fixtures_table.c.id.in_(fixture_ids))
        if team_id is not None:
            conditions.append(
                or_(
                    fpl_fixtures_table.c.home_team_id == team_id,
                    fpl_fixtures_table.c.away_team_id == team_id,
                )
            )
        if finished_only:
            conditions.append(fpl_fixtures_table.c.finished.is_(True))
        if conditions:
            statement = statement.where(*conditions)
        statement = statement.order_by(
            fpl_fixtures_table.c.kickoff_time.desc().nulls_last(),
            fpl_fixtures_table.c.id.desc(),
        )
        if limit is not None:
            statement = statement.limit(limit)
        return list(session.execute(statement).mappings())

    def record_failure(
        self,
        *,
        resource: FplRefreshResource | str,
        endpoint: str,
        fetched_at: datetime,
        error: str,
        status_code: int | None = None,
    ) -> None:
        resource_value = _resource_value(resource)
        with self._session_factory() as session:
            session.execute(
                insert(external_fetch_log_table).values(
                    id=uuid4().hex,
                    resource=resource_value,
                    endpoint=endpoint,
                    status_code=status_code,
                    response_sha256=None,
                    record_count=0,
                    error=error[:512],
                    fetched_at=fetched_at,
                )
            )
            session.commit()

    def status(self) -> FplCacheStatusResponse:
        with self._session_factory() as session:
            freshness = {
                str(row.resource): row.last_updated_at
                for row in session.execute(select(fpl_cache_freshness_table)).mappings()
            }
            fetch_rows = list(
                session.execute(
                    select(external_fetch_log_table).order_by(
                        external_fetch_log_table.c.fetched_at.desc()
                    )
                ).mappings()
            )
            latest_fetch: dict[str, Mapping[str, object]] = {}
            for row in fetch_rows:
                latest_fetch.setdefault(str(row["resource"]), row)

            counts = {
                "gameweeks": _count(session, fpl_gameweeks_table),
                "teams": _count(session, epl_teams_table),
                "players": int(
                    session.execute(
                        select(func.count())
                        .select_from(fpl_players_table)
                        .where(fpl_players_table.c.id.like("fpl-%"))
                    ).scalar_one()
                ),
                "player_metrics": _count(session, fpl_player_current_metrics_table),
                "fixtures": _count(session, fpl_fixtures_table),
            }

        resources = []
        for resource in FplRefreshResource:
            latest = latest_fetch.get(resource.value)
            resources.append(
                FplResourceStatus(
                    resource=resource,
                    last_updated_at=freshness.get(resource.value),
                    last_fetch_status=(
                        int(latest["status_code"])
                        if latest is not None and latest["status_code"] is not None
                        else None
                    ),
                    last_fetch_error=(
                        str(latest["error"])
                        if latest is not None and latest["error"] is not None
                        else None
                    ),
                    response_sha256=(
                        str(latest["response_sha256"])
                        if latest is not None and latest["response_sha256"] is not None
                        else None
                    ),
                )
            )
        return FplCacheStatusResponse(resources=resources, normalized_counts=counts)

    @staticmethod
    def _record_success(
        session: Session,
        *,
        resource: FplRefreshResource | str,
        endpoint: str,
        status_code: int,
        response_sha256: str,
        payload: dict[str, object] | list[dict[str, object]],
        fetched_at: datetime,
        record_count: int,
    ) -> None:
        resource_value = _resource_value(resource)
        _upsert_many(
            session,
            external_payload_cache_table,
            [
                {
                    "resource": resource_value,
                    "endpoint": endpoint,
                    "payload_json": payload,
                    "response_sha256": response_sha256,
                    "fetched_at": fetched_at,
                }
            ],
        )
        _upsert_many(
            session,
            fpl_cache_freshness_table,
            [{"resource": resource_value, "last_updated_at": fetched_at}],
        )
        session.execute(
            insert(external_fetch_log_table).values(
                id=uuid4().hex,
                resource=resource_value,
                endpoint=endpoint,
                status_code=status_code,
                response_sha256=response_sha256,
                record_count=record_count,
                error=None,
                fetched_at=fetched_at,
            )
        )


def _player_fixture_enrichment(
    history: object,
    contexts: Mapping[str, Mapping[str, object]],
) -> dict[str, object]:
    context = contexts.get(str(history.fixture_id))
    if context is None:
        return {}
    is_home = bool(history.was_home)
    return {
        "opponent_name": context["away_team_name" if is_home else "home_team_name"],
        "opponent_short_name": context[
            "away_team_short_name" if is_home else "home_team_short_name"
        ],
        "difficulty": context["home_difficulty" if is_home else "away_difficulty"],
    }


def _upcoming_fixture_enrichment(
    fixture: object,
    contexts: Mapping[str, Mapping[str, object]],
) -> dict[str, object]:
    context = contexts.get(str(fixture.fixture_id))
    if context is None:
        return {}
    is_home = bool(fixture.is_home)
    return {
        "opponent_name": context["away_team_name" if is_home else "home_team_name"],
        "opponent_short_name": context[
            "away_team_short_name" if is_home else "home_team_short_name"
        ],
        "difficulty": context["home_difficulty" if is_home else "away_difficulty"]
        or fixture.difficulty,
        "opponent_difficulty": context["away_difficulty" if is_home else "home_difficulty"],
    }


def _next_gameweek_fixtures(fixtures: list[object]) -> list[object]:
    """Return every fixture in the earliest upcoming gameweek."""
    gameweeks = [fixture.gameweek for fixture in fixtures if fixture.gameweek is not None]
    if not gameweeks:
        return fixtures[:1]
    next_gameweek = min(gameweeks)
    return [fixture for fixture in fixtures if fixture.gameweek == next_gameweek]


def _defensive_history_from_fixture(
    row: Mapping[str, object],
    target_team_id: str,
) -> FplOpponentDefensiveHistory:
    is_home = str(row["home_team_id"]) == target_team_id
    total_points, attacking_points, defensive_points = _fixture_asset_points(
        row["payload_json"],
        target_team_id=target_team_id,
        home_team_id=str(row["home_team_id"]),
        away_team_id=str(row["away_team_id"]),
    )
    return FplOpponentDefensiveHistory(
        fixture_id=int(row["fixture_id"]),
        gameweek=int(row["gameweek"]) if row["gameweek"] is not None else None,
        opponent_name=str(row["away_team_name"] if is_home else row["home_team_name"]),
        opponent_short_name=str(
            row["away_team_short_name"] if is_home else row["home_team_short_name"]
        ),
        is_home=is_home,
        difficulty=(row["home_difficulty"] if is_home else row["away_difficulty"]),
        total_points_conceded=total_points,
        attacking_asset_points=attacking_points,
        defensive_asset_points=defensive_points,
    )


def _fixture_asset_points(
    payload: object,
    *,
    target_team_id: str,
    home_team_id: str,
    away_team_id: str,
) -> tuple[int | None, int | None, int | None]:
    if not isinstance(payload, Mapping) or not isinstance(payload.get("stats"), list):
        return None, None, None
    target_is_home = target_team_id == home_team_id
    opposition_side = "a" if target_is_home else "h"
    total_by_element: dict[str, int] = {}
    total_from_stat_points = 0
    stat_points_found = False
    attacking_points = 0
    defensive_points = 0
    attacking_identifiers = {
        "goals_scored",
        "assists",
        "penalties_missed",
        "own_goals",
    }
    defensive_identifiers = {
        "clean_sheets",
        "saves",
        "defensive_contribution",
        "defensive_contributions",
        "clearances_blocks_interceptions",
        "recoveries",
        "tackles",
        "bonus",
    }
    for group in payload["stats"]:
        if not isinstance(group, Mapping):
            continue
        identifier = str(group.get("identifier") or "")
        entries = group.get(opposition_side)
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, Mapping):
                continue
            element = str(entry.get("element") or "")
            total_points = _optional_int_value(entry.get("total_points"))
            if total_points is not None and element:
                total_by_element[element] = total_points
            stat_points = _optional_int_value(entry.get("points"))
            if stat_points is None:
                continue
            stat_points_found = True
            total_from_stat_points += stat_points
            if identifier in attacking_identifiers:
                attacking_points += stat_points
            elif identifier in defensive_identifiers:
                defensive_points += stat_points

    total_points = (
        sum(total_by_element.values())
        if total_by_element
        else (total_from_stat_points if stat_points_found else None)
    )
    return (
        total_points,
        (attacking_points if stat_points_found else None),
        (defensive_points if stat_points_found else None),
    )


def _optional_int_value(value: object) -> int | None:
    if value is None or value == "" or isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _resource_value(resource: FplRefreshResource | str) -> str:
    return resource.value if isinstance(resource, FplRefreshResource) else resource


def _player_id(row: Mapping[str, object]) -> str:
    return f"fpl-{_required_int(row, 'id')}"


def _upsert_many(session: Session, table: Table, rows: list[dict[str, object]]) -> None:
    if not rows:
        return
    primary_key = next(iter(table.primary_key.columns))
    key_name = primary_key.name
    keys = [row[key_name] for row in rows]
    existing = set(session.execute(select(primary_key).where(primary_key.in_(keys))).scalars())
    new_rows = [row for row in rows if row[key_name] not in existing]
    changed_rows = [row for row in rows if row[key_name] in existing]
    if new_rows:
        session.execute(insert(table), new_rows)
    for row in changed_rows:
        session.execute(
            update(table)
            .where(primary_key == row[key_name])
            .values(**{name: value for name, value in row.items() if name != key_name})
        )


def _count(session: Session, table: Table) -> int:
    return int(session.execute(select(func.count()).select_from(table)).scalar_one())


def _list_of_mappings(payload: Mapping[str, object], key: str) -> list[Mapping[str, object]]:
    value = payload.get(key)
    if not isinstance(value, list) or not all(isinstance(row, Mapping) for row in value):
        raise InvalidFplPayloadError(f"FPL payload field {key!r} must be a list of objects.")
    return list(value)


def _position_id(row: Mapping[str, object], position_ids: Mapping[int, str]) -> str:
    element_type = _required_int(row, "element_type")
    try:
        return position_ids[element_type]
    except KeyError as exc:
        raise InvalidFplPayloadError(
            f"FPL player references unknown element type {element_type}."
        ) from exc


def _required_int(row: Mapping[str, object], key: str) -> int:
    value = row.get(key)
    if isinstance(value, bool):
        raise InvalidFplPayloadError(f"FPL field {key!r} must be an integer.")
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise InvalidFplPayloadError(f"FPL field {key!r} must be an integer.") from exc


def _optional_int(value: object) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise InvalidFplPayloadError("FPL optional integer field cannot be boolean.")
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise InvalidFplPayloadError("FPL optional integer field is invalid.") from exc


def _optional_float(value: object) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise InvalidFplPayloadError("FPL optional numeric field cannot be boolean.")
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise InvalidFplPayloadError("FPL optional numeric field is invalid.") from exc


def _required_text(row: Mapping[str, object], key: str) -> str:
    value = row.get(key)
    if not isinstance(value, str) or not value.strip():
        raise InvalidFplPayloadError(f"FPL field {key!r} must be non-empty text.")
    return value.strip()


def _optional_datetime(value: object) -> datetime | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise InvalidFplPayloadError("FPL datetime field must be ISO-8601 text.")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise InvalidFplPayloadError("FPL datetime field must be valid ISO-8601 text.") from exc


def _active_gameweek(events: Iterable[Mapping[str, object]]) -> int:
    rows = list(events)
    for marker in ("is_current", "is_next"):
        for row in rows:
            if row.get(marker) is True:
                return _required_int(row, "id")
    ids = [_required_int(row, "id") for row in rows]
    return max(ids, default=0)
