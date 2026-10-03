"""PostgreSQL-backed squad interest and trade repository."""

from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Integer, and_, cast, exists, func, insert, literal, or_, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.sql.selectable import Subquery

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.squad import (
    InterestResponse,
    PlayerDetail,
    PlayerFormFixture,
    PlayerFormGameweek,
    PlayerNextFixture,
    PlayerOwnershipStatus,
    ScoutingFilters,
    TradeApprovalDecision,
    TradeApprovalStatus,
    TradeAsset,
    TradeAuditEventResponse,
    TradeProposal,
    TradeStatus,
)
from cdl_api.repositories.postgres_fpl_data import (
    external_payload_cache_table,
    fpl_fixtures_table,
    fpl_gameweeks_table,
    fpl_player_current_metrics_table,
    next_upcoming_gameweek_number,
)
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    epl_teams_table,
    fpl_player_availability_table,
    fpl_player_values_table,
    fpl_players_table,
    fpl_positions_table,
    league_memberships_table,
    managers_table,
    seasons_table,
)
from cdl_api.repositories.postgres_squad import (
    loans_table,
    player_rights_table,
    squad_audit_events_table,
    squad_interests_table,
    squad_ownerships_table,
    squad_roster_slots_table,
    trade_approvals_table,
    trade_assets_table,
    trade_proposals_table,
)
from cdl_api.repositories.squad import InMemorySquadRepository
from cdl_api.services.live_draft import ensure_squad_moves_allowed
from cdl_api.staging_draft_seed import (
    PRIMARY_MANAGER_ID,
    PRIMARY_TEAM_ID,
    SEASON_ID,
    TEAM_IDS,
    TEAM_NAMES,
    UnassignedManagerContextError,
    resolve_staging_manager_context,
)

DEMO_SEASON_ID = SEASON_ID
DEMO_MANAGER_ID = PRIMARY_MANAGER_ID
DEMO_RIVAL_MANAGER_ID = "manager-2"


def _merge_summary_form_history(
    history: dict[str, dict[int, dict[str, PlayerFormFixture]]],
    player_id: str,
    payload: object,
) -> None:
    if player_id not in history or not isinstance(payload, Mapping):
        return
    rows = payload.get("history")
    if not isinstance(rows, list):
        return
    for row in rows:
        if not isinstance(row, Mapping):
            continue
        gameweek = _safe_int(row.get("round"))
        fixture_id = row.get("fixture")
        if gameweek is None or fixture_id is None:
            continue
        history[player_id].setdefault(gameweek, {})[str(fixture_id)] = PlayerFormFixture(
            fixture_id=str(fixture_id),
            total_points=_safe_int(row.get("total_points")) or 0,
            minutes=_safe_int(row.get("minutes")) or 0,
        )


def _merge_live_form_history(
    history: dict[str, dict[int, dict[str, PlayerFormFixture]]],
    requested: set[str],
    gameweek: int,
    payload: object,
) -> None:
    if not isinstance(payload, Mapping) or not isinstance(payload.get("elements"), list):
        return
    for element in payload["elements"]:
        if not isinstance(element, Mapping) or element.get("id") is None:
            continue
        player_id = f"fpl-{element['id']}"
        if player_id not in requested:
            continue
        explanations = element.get("explain")
        if isinstance(explanations, list) and explanations:
            for explanation in explanations:
                if not isinstance(explanation, Mapping) or explanation.get("fixture") is None:
                    continue
                stats = explanation.get("stats")
                if not isinstance(stats, list):
                    continue
                points = sum(
                    _safe_int(stat.get("points")) or 0
                    for stat in stats
                    if isinstance(stat, Mapping)
                )
                minutes = next(
                    (
                        _safe_int(stat.get("value")) or 0
                        for stat in stats
                        if isinstance(stat, Mapping) and stat.get("identifier") == "minutes"
                    ),
                    0,
                )
                fixture_id = str(explanation["fixture"])
                history[player_id].setdefault(gameweek, {})[fixture_id] = PlayerFormFixture(
                    fixture_id=fixture_id,
                    total_points=points,
                    minutes=minutes,
                )
            continue
        stats = element.get("stats")
        if isinstance(stats, Mapping):
            fixture_id = f"event-live:{gameweek}:{element['id']}"
            history[player_id].setdefault(gameweek, {})[fixture_id] = PlayerFormFixture(
                fixture_id=fixture_id,
                total_points=_safe_int(stats.get("total_points")) or 0,
                minutes=_safe_int(stats.get("minutes")) or 0,
            )


def _gameweek_from_resource(resource: str) -> int | None:
    if not resource.startswith("event-live:"):
        return None
    return _safe_int(resource.removeprefix("event-live:"))


def _safe_int(value: object) -> int | None:
    try:
        return int(value) if value is not None and value != "" else None
    except (TypeError, ValueError):
        return None


def _active_gameweek_player_values_subquery() -> Subquery:
    """Select player prices for the current FPL season/gameweek.

    Player values are retained by gameweek for auditability. A plain maximum
    gameweek lookup is incorrect at a season rollover because the new season
    starts at gameweek 1 while last season's gameweek 38 rows still exist.
    Prefer the official current gameweek, falling back to the official next
    gameweek during the pre-season window.
    """
    active_gameweek = (
        select(cast(fpl_gameweeks_table.c.id, Integer))
        .where(
            or_(
                fpl_gameweeks_table.c.is_current.is_(True),
                fpl_gameweeks_table.c.is_next.is_(True),
            )
        )
        .order_by(
            fpl_gameweeks_table.c.is_current.desc(),
            fpl_gameweeks_table.c.is_next.desc(),
            fpl_gameweeks_table.c.deadline_time.asc().nulls_last(),
        )
        .limit(1)
        .scalar_subquery()
    )
    return (
        select(
            fpl_player_values_table.c.player_id,
            func.max(fpl_player_values_table.c.gameweek).label("gameweek"),
        )
        .where(fpl_player_values_table.c.gameweek == active_gameweek)
        .group_by(fpl_player_values_table.c.player_id)
        .subquery("active_gameweek_player_values")
    )


class PostgreSQLSquadRepository(InMemorySquadRepository):
    def __init__(
        self,
        session_factory: Callable[[], Session],
        user_id: str | None = None,
    ) -> None:
        super().__init__()
        self._session_factory = session_factory
        self.manager_team = TeamSummary(id=PRIMARY_TEAM_ID, name=TEAM_NAMES[0])
        self.rival_team = TeamSummary(id=TEAM_IDS[1], name=TEAM_NAMES[1])
        self._manager_id = DEMO_MANAGER_ID
        self._players_cache: list[PlayerDetail] | None = None

        context = resolve_staging_manager_context(session_factory, user_id)
        if user_id is not None and context is None:
            raise UnassignedManagerContextError("A team assignment is required.")
        if context is not None:
            (
                self._manager_id,
                manager_team_id,
                manager_team_name,
                rival_team_id,
                rival_team_name,
            ) = context
            self.manager_team = TeamSummary(id=manager_team_id, name=manager_team_name)
            self.rival_team = TeamSummary(id=rival_team_id, name=rival_team_name)

    def seed_demo_data(self) -> None:
        """Seed hooks are owned by imports in #69; runtime writes are persisted here."""

    def _database_players(self) -> list[PlayerDetail]:
        if self._players_cache is not None:
            return self._players_cache

        active_ownerships = squad_ownerships_table.alias("active_ownerships")
        canonical_players = fpl_players_table.alias("canonical_players")
        latest_values = _active_gameweek_player_values_subquery()
        legacy_without_canonical_counterpart = ~exists(
            select(1)
            .select_from(canonical_players)
            .where(canonical_players.c.id == literal("fpl-") + fpl_players_table.c.id)
        )
        with self._session_factory() as session:
            rows = list(
                session.execute(
                    select(
                        fpl_players_table.c.id,
                        fpl_players_table.c.web_name,
                        fpl_players_table.c.position_id,
                        epl_teams_table.c.id.label("epl_team_id"),
                        epl_teams_table.c.name.label("epl_team_name"),
                        epl_teams_table.c.short_name.label("epl_team_short_name"),
                        draft_teams_table.c.id.label("draft_team_id"),
                        draft_teams_table.c.name.label("draft_team_name"),
                        active_ownerships.c.id.label("ownership_id"),
                        fpl_player_values_table.c.value.label("current_value"),
                        fpl_player_availability_table.c.status.label("availability_status"),
                        fpl_player_availability_table.c.news.label("availability_news"),
                        fpl_player_current_metrics_table.c.total_points,
                        fpl_player_current_metrics_table.c.form,
                        fpl_player_current_metrics_table.c.selected_by_percent,
                        fpl_player_current_metrics_table.c.minutes,
                        fpl_player_current_metrics_table.c.goals_scored,
                        fpl_player_current_metrics_table.c.assists,
                        fpl_player_current_metrics_table.c.clean_sheets,
                        fpl_player_current_metrics_table.c.expected_goals,
                        fpl_player_current_metrics_table.c.expected_assists,
                        fpl_player_current_metrics_table.c.chance_of_playing_next_round,
                    )
                    .join(epl_teams_table, fpl_players_table.c.team_id == epl_teams_table.c.id)
                    .outerjoin(
                        latest_values,
                        latest_values.c.player_id == fpl_players_table.c.id,
                    )
                    .outerjoin(
                        fpl_player_values_table,
                        (fpl_player_values_table.c.player_id == fpl_players_table.c.id)
                        & (fpl_player_values_table.c.gameweek == latest_values.c.gameweek),
                    )
                    .outerjoin(
                        fpl_player_availability_table,
                        fpl_player_availability_table.c.player_id == fpl_players_table.c.id,
                    )
                    .outerjoin(
                        fpl_player_current_metrics_table,
                        fpl_player_current_metrics_table.c.player_id == fpl_players_table.c.id,
                    )
                    .outerjoin(
                        active_ownerships,
                        (active_ownerships.c.player_id == fpl_players_table.c.id)
                        & (active_ownerships.c.season_id == DEMO_SEASON_ID)
                        & active_ownerships.c.ended_at.is_(None),
                    )
                    .outerjoin(
                        draft_teams_table,
                        active_ownerships.c.draft_team_id == draft_teams_table.c.id,
                    )
                    .where(
                        or_(
                            fpl_players_table.c.id.like("fpl-%"),
                            legacy_without_canonical_counterpart,
                        )
                    )
                    .order_by(active_ownerships.c.id, fpl_players_table.c.web_name)
                ).mappings()
            )
            next_fixtures = self._next_fixtures_by_team(session)
            form_history_by_player = self._form_history_by_players(
                session,
                [str(row["id"]) for row in rows],
            )
        self._players_cache = [
            self._player_from_database_row(
                row,
                next_fixtures.get(row["epl_team_id"]),
                form_history_by_player.get(str(row["id"]), []),
            )
            for row in rows
        ]
        return self._players_cache

    def form_history_for_players(
        self,
        player_ids: list[str],
    ) -> dict[str, list[PlayerFormGameweek]]:
        if not player_ids:
            return {}
        with self._session_factory() as session:
            return self._form_history_by_players(session, player_ids)

    @staticmethod
    def _form_history_by_players(
        session: Session,
        player_ids: list[str],
    ) -> dict[str, list[PlayerFormGameweek]]:
        requested = {str(player_id) for player_id in player_ids}
        history: dict[str, dict[int, dict[str, PlayerFormFixture]]] = {
            player_id: {} for player_id in requested
        }
        if not requested:
            return {}

        resources = [f"element-summary:{player_id}" for player_id in requested]
        try:
            summary_rows = session.execute(
                select(
                    external_payload_cache_table.c.resource,
                    external_payload_cache_table.c.payload_json,
                ).where(external_payload_cache_table.c.resource.in_(resources))
            ).mappings()
            for row in summary_rows:
                player_id = str(row["resource"])[len("element-summary:") :]
                _merge_summary_form_history(history, player_id, row["payload_json"])

            live_rows = session.execute(
                select(
                    external_payload_cache_table.c.resource,
                    external_payload_cache_table.c.payload_json,
                ).where(external_payload_cache_table.c.resource.like("event-live:%"))
            ).mappings()
            for row in live_rows:
                gameweek = _gameweek_from_resource(str(row["resource"]))
                if gameweek is not None:
                    _merge_live_form_history(history, requested, gameweek, row["payload_json"])
        except SQLAlchemyError:
            return {player_id: [] for player_id in requested}

        return {
            player_id: [
                PlayerFormGameweek(gameweek=gameweek, fixtures=list(fixtures.values()))
                for gameweek, fixtures in sorted(gameweeks.items())[-5:]
            ]
            for player_id, gameweeks in history.items()
        }

    def _invalidate_players_cache(self) -> None:
        self._players_cache = None

    def fixture_contexts_by_team(self, gameweek_number: int) -> dict[str, list[PlayerNextFixture]]:
        """Return the official FPL fixtures for each club in one gameweek."""
        home_team = epl_teams_table.alias("fixture_context_home_team")
        away_team = epl_teams_table.alias("fixture_context_away_team")
        try:
            with self._session_factory() as session:
                rows = list(
                    session.execute(
                        select(
                            fpl_fixtures_table.c.id,
                            fpl_fixtures_table.c.gameweek,
                            fpl_fixtures_table.c.home_team_id,
                            fpl_fixtures_table.c.away_team_id,
                            fpl_fixtures_table.c.kickoff_time,
                            fpl_fixtures_table.c.home_difficulty,
                            fpl_fixtures_table.c.away_difficulty,
                            home_team.c.name.label("home_team_name"),
                            home_team.c.short_name.label("home_team_short_name"),
                            away_team.c.name.label("away_team_name"),
                            away_team.c.short_name.label("away_team_short_name"),
                        )
                        .join(home_team, fpl_fixtures_table.c.home_team_id == home_team.c.id)
                        .join(away_team, fpl_fixtures_table.c.away_team_id == away_team.c.id)
                        .where(fpl_fixtures_table.c.gameweek == gameweek_number)
                        .order_by(fpl_fixtures_table.c.kickoff_time.asc().nulls_last())
                    ).mappings()
                )
        except SQLAlchemyError:
            return {}

        fixture_contexts: dict[str, list[PlayerNextFixture]] = {}
        for row in rows:
            gameweek = (
                GameweekSummary(
                    id=f"gw-{row['gameweek']}",
                    name=f"Gameweek {row['gameweek']}",
                    number=int(row["gameweek"]),
                )
                if row["gameweek"] is not None
                else None
            )
            home_fixture = PlayerNextFixture(
                fixture_id=str(row["id"]),
                gameweek=gameweek,
                opponent=TeamSummary(
                    id=str(row["away_team_id"]),
                    name=str(row["away_team_name"]),
                    short_name=str(row["away_team_short_name"]),
                ),
                difficulty=row["home_difficulty"],
                is_home=True,
                kickoff_at=row["kickoff_time"],
            )
            away_fixture = PlayerNextFixture(
                fixture_id=str(row["id"]),
                gameweek=gameweek,
                opponent=TeamSummary(
                    id=str(row["home_team_id"]),
                    name=str(row["home_team_name"]),
                    short_name=str(row["home_team_short_name"]),
                ),
                difficulty=row["away_difficulty"],
                is_home=False,
                kickoff_at=row["kickoff_time"],
            )
            fixture_contexts.setdefault(str(row["home_team_id"]), []).append(home_fixture)
            fixture_contexts.setdefault(str(row["away_team_id"]), []).append(away_fixture)
        return fixture_contexts

    @staticmethod
    def _next_fixtures_by_team(session: Session) -> dict[str, list[PlayerNextFixture]]:
        home_team = epl_teams_table.alias("fixture_home_team")
        away_team = epl_teams_table.alias("fixture_away_team")
        try:
            rows = list(
                session.execute(
                    select(
                        fpl_fixtures_table.c.id,
                        fpl_fixtures_table.c.gameweek,
                        fpl_fixtures_table.c.home_team_id,
                        fpl_fixtures_table.c.away_team_id,
                        fpl_fixtures_table.c.kickoff_time,
                        fpl_fixtures_table.c.home_difficulty,
                        fpl_fixtures_table.c.away_difficulty,
                        home_team.c.name.label("home_team_name"),
                        home_team.c.short_name.label("home_team_short_name"),
                        away_team.c.name.label("away_team_name"),
                        away_team.c.short_name.label("away_team_short_name"),
                    )
                    .join(home_team, fpl_fixtures_table.c.home_team_id == home_team.c.id)
                    .join(away_team, fpl_fixtures_table.c.away_team_id == away_team.c.id)
                    .where(
                        fpl_fixtures_table.c.started.is_(False),
                        fpl_fixtures_table.c.finished.is_(False),
                    )
                    .order_by(fpl_fixtures_table.c.kickoff_time.asc().nulls_last())
                ).mappings()
            )
            next_gameweek = next_upcoming_gameweek_number(session)
            if next_gameweek is None:
                next_gameweek = min(
                    (int(row["gameweek"]) for row in rows if row["gameweek"] is not None),
                    default=None,
                )
        except SQLAlchemyError:
            return {}
        fixtures_by_team: dict[str, list[PlayerNextFixture]] = {}
        for row in rows:
            gameweek_number = row["gameweek"]
            gameweek = (
                GameweekSummary(
                    id=f"gw-{gameweek_number}",
                    name=f"Gameweek {gameweek_number}",
                    number=int(gameweek_number),
                )
                if gameweek_number is not None
                else None
            )
            home_fixture = PlayerNextFixture(
                fixture_id=str(row["id"]),
                gameweek=gameweek,
                opponent=TeamSummary(
                    id=str(row["away_team_id"]),
                    name=str(row["away_team_name"]),
                    short_name=str(row["away_team_short_name"]),
                ),
                difficulty=row["home_difficulty"],
                is_home=True,
                kickoff_at=row["kickoff_time"],
            )
            away_fixture = PlayerNextFixture(
                fixture_id=str(row["id"]),
                gameweek=gameweek,
                opponent=TeamSummary(
                    id=str(row["home_team_id"]),
                    name=str(row["home_team_name"]),
                    short_name=str(row["home_team_short_name"]),
                ),
                difficulty=row["away_difficulty"],
                is_home=False,
                kickoff_at=row["kickoff_time"],
            )
            fixtures_by_team.setdefault(str(row["home_team_id"]), []).append(home_fixture)
            fixtures_by_team.setdefault(str(row["away_team_id"]), []).append(away_fixture)

        next_fixtures: dict[str, list[PlayerNextFixture]] = {}
        for team_id, team_fixtures in fixtures_by_team.items():
            if next_gameweek is not None:
                selected = [
                    fixture
                    for fixture in team_fixtures
                    if fixture.gameweek is not None and fixture.gameweek.number == next_gameweek
                ]
            else:
                selected = team_fixtures[:1]
            next_fixtures[team_id] = sorted(
                selected,
                key=lambda fixture: (
                    fixture.kickoff_at is None,
                    fixture.kickoff_at,
                    fixture.fixture_id,
                ),
            )
        return next_fixtures

    @staticmethod
    def _player_from_database_row(
        row: object,
        next_fixtures: list[PlayerNextFixture] | None = None,
        form_history: list[PlayerFormGameweek] | None = None,
    ) -> PlayerDetail:
        upcoming_fixtures = next_fixtures or []
        epl_team = TeamSummary(
            id=row["epl_team_id"],
            name=row["epl_team_name"],
            short_name=row["epl_team_short_name"],
        )
        draft_team = (
            TeamSummary(id=row["draft_team_id"], name=row["draft_team_name"])
            if row["draft_team_id"] is not None
            else None
        )
        return PlayerDetail(
            id=row["id"],
            display_name=row["web_name"],
            position=row["position_id"],
            team=epl_team,
            epl_team=epl_team,
            draft_team=draft_team,
            status=(
                PlayerOwnershipStatus.OWNED
                if draft_team is not None
                else PlayerOwnershipStatus.AVAILABLE
            ),
            points=int(row["total_points"] or 0),
            form=float(row["form"] or 0),
            value=float(row["current_value"] or 0) / 10,
            selected_by_percent=float(row["selected_by_percent"] or 0),
            minutes=int(row["minutes"] or 0),
            goals_scored=int(row["goals_scored"] or 0),
            assists=int(row["assists"] or 0),
            clean_sheets=int(row["clean_sheets"] or 0),
            expected_goals=float(row["expected_goals"] or 0),
            expected_assists=float(row["expected_assists"] or 0),
            availability_status=row["availability_status"],
            availability_news=row["availability_news"] or "",
            chance_of_playing_next_round=row["chance_of_playing_next_round"],
            next_fixture=upcoming_fixtures[0] if upcoming_fixtures else None,
            next_fixtures=upcoming_fixtures,
            form_history=form_history or [],
        )

    def list_squad_players(self) -> list[PlayerDetail]:
        return [player for player in self._database_players() if player.draft_team is not None]

    def list_players(self, filters: ScoutingFilters) -> list[PlayerDetail]:
        players = self._database_players()
        if filters.position is not None:
            players = [player for player in players if player.position == filters.position]
        if filters.draft_team_id is not None:
            players = [
                player
                for player in players
                if player.draft_team is not None and player.draft_team.id == filters.draft_team_id
            ]
        if filters.epl_team_id is not None:
            players = [player for player in players if player.epl_team.id == filters.epl_team_id]
        if filters.query:
            query = filters.query.casefold()
            players = [player for player in players if query in player.display_name.casefold()]
        with self._session_factory() as session:
            interested_player_ids = set(
                session.execute(
                    select(squad_interests_table.c.player_id).where(
                        squad_interests_table.c.status == "active"
                    )
                ).scalars()
            )
        for player in players:
            if player.id in interested_player_ids and player.draft_team is None:
                player.status = PlayerOwnershipStatus.INTERESTED
        metric = "points" if filters.metric.value == "total_points" else filters.metric.value
        return sorted(players, key=lambda player: getattr(player, metric), reverse=True)

    def list_available_rights(self) -> list[PlayerDetail]:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            player_ids = list(
                session.execute(
                    select(player_rights_table.c.player_id)
                    .where(
                        player_rights_table.c.season_id == DEMO_SEASON_ID,
                        player_rights_table.c.draft_team_id == self.manager_team.id,
                        player_rights_table.c.released_at.is_(None),
                        (player_rights_table.c.expires_at.is_(None))
                        | (player_rights_table.c.expires_at > now),
                    )
                    .order_by(player_rights_table.c.acquired_at)
                ).scalars()
            )
        players = {player.id: player for player in self._database_players()}
        available = []
        for player_id in player_ids:
            player = players.get(str(player_id))
            if player is not None and player.draft_team is None:
                player.status = PlayerOwnershipStatus.AVAILABLE
                available.append(player)
        return available

    def apply_squad_changes(self, add_player_ids: list[str], remove_player_ids: list[str]) -> None:
        if len(add_player_ids) != len(remove_player_ids):
            raise ValueError("Each squad addition must replace one removed player.")
        if not add_player_ids:
            return
        now = datetime.now(UTC)
        with self._session_factory() as session:
            season_exists = session.execute(
                select(seasons_table.c.id)
                .where(seasons_table.c.id == DEMO_SEASON_ID)
                .with_for_update()
            ).scalar_one_or_none()
            if season_exists is None:
                raise ValueError("Active season could not be found.")
            ensure_squad_moves_allowed(session, DEMO_SEASON_ID)
            rights = list(
                session.execute(
                    select(player_rights_table).where(
                        player_rights_table.c.season_id == DEMO_SEASON_ID,
                        player_rights_table.c.draft_team_id == self.manager_team.id,
                        player_rights_table.c.player_id.in_(add_player_ids),
                        player_rights_table.c.released_at.is_(None),
                        (player_rights_table.c.expires_at.is_(None))
                        | (player_rights_table.c.expires_at > now),
                    )
                ).mappings()
            )
            if {str(row["player_id"]) for row in rights} != set(add_player_ids):
                raise ValueError("Every added player must have an active temporary right.")
            ownerships = list(
                session.execute(
                    select(squad_ownerships_table)
                    .where(
                        squad_ownerships_table.c.season_id == DEMO_SEASON_ID,
                        squad_ownerships_table.c.draft_team_id == self.manager_team.id,
                        squad_ownerships_table.c.player_id.in_(remove_player_ids),
                        squad_ownerships_table.c.ended_at.is_(None),
                    )
                    .order_by(squad_ownerships_table.c.started_at)
                ).mappings()
            )
            if {str(row["player_id"]) for row in ownerships} != set(remove_player_ids):
                raise ValueError("Every removed player must be in the active squad.")
            active_loaned_players = set(
                session.execute(
                    select(loans_table.c.player_id).where(
                        loans_table.c.season_id == DEMO_SEASON_ID,
                        loans_table.c.borrower_team_id == self.manager_team.id,
                        loans_table.c.player_id.in_(remove_player_ids),
                        loans_table.c.status == "active",
                    )
                ).scalars()
            )
            if active_loaned_players:
                raise ValueError("An active loan player cannot be removed before scheduled return.")
            slots_by_player = {str(row["player_id"]): row["roster_slot_id"] for row in ownerships}
            for player_id in remove_player_ids:
                session.execute(
                    update(squad_ownerships_table)
                    .where(squad_ownerships_table.c.player_id == player_id)
                    .where(squad_ownerships_table.c.draft_team_id == self.manager_team.id)
                    .where(squad_ownerships_table.c.season_id == DEMO_SEASON_ID)
                    .where(squad_ownerships_table.c.ended_at.is_(None))
                    .values(ended_at=now)
                )
            for index, player_id in enumerate(add_player_ids):
                session.execute(
                    insert(squad_ownerships_table).values(
                        id=f"ownership-right-{uuid4().hex[:12]}",
                        season_id=DEMO_SEASON_ID,
                        draft_team_id=self.manager_team.id,
                        player_id=player_id,
                        roster_slot_id=slots_by_player[remove_player_ids[index]],
                        started_at=now,
                        ended_at=None,
                    )
                )
                session.execute(
                    update(player_rights_table)
                    .where(
                        player_rights_table.c.season_id == DEMO_SEASON_ID,
                        player_rights_table.c.draft_team_id == self.manager_team.id,
                        player_rights_table.c.player_id == player_id,
                        player_rights_table.c.released_at.is_(None),
                    )
                    .values(released_at=now)
                )
            session.commit()
        self._invalidate_players_cache()

    def get_player(self, player_id: str) -> PlayerDetail | None:
        return next(
            (player for player in self._database_players() if player.id == player_id),
            None,
        )

    def list_interests(self) -> list[InterestResponse]:
        with self._session_factory() as session:
            rows = list(
                session.execute(
                    select(
                        squad_interests_table.c.id,
                        squad_interests_table.c.player_id,
                        squad_interests_table.c.gameweek,
                        squad_interests_table.c.note,
                    )
                    .where(
                        squad_interests_table.c.manager_id == self._manager_id,
                        squad_interests_table.c.status == "active",
                    )
                    .order_by(squad_interests_table.c.created_at)
                ).mappings()
            )
        return [self._interest_from_row(row) for row in rows]

    def find_active_interest_by_player(self, player_id: str) -> InterestResponse | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(
                        squad_interests_table.c.id,
                        squad_interests_table.c.player_id,
                        squad_interests_table.c.gameweek,
                        squad_interests_table.c.note,
                    ).where(
                        squad_interests_table.c.manager_id == self._manager_id,
                        squad_interests_table.c.player_id == player_id,
                        squad_interests_table.c.status == "active",
                    )
                )
                .mappings()
                .first()
            )
        return None if row is None else self._interest_from_row(row)

    def _interest_from_row(self, row: object) -> InterestResponse:
        player = self.get_player(row["player_id"])
        if player is None:
            raise ValueError(f"Unknown interest player: {row['player_id']}")
        player.status = PlayerOwnershipStatus.INTERESTED
        gameweek_number = int(row["gameweek"])
        gameweek = self.gameweek.model_copy(
            update={
                "id": f"gw-{gameweek_number}",
                "name": f"Gameweek {gameweek_number}",
                "number": gameweek_number,
            }
        )
        return InterestResponse(
            id=row["id"],
            player=player,
            gameweek=gameweek,
            note=row["note"] or None,
        )

    def save_interest(self, interest: InterestResponse) -> InterestResponse:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            session.execute(
                insert(squad_interests_table).values(
                    id=interest.id,
                    season_id=DEMO_SEASON_ID,
                    draft_team_id=self.manager_team.id,
                    manager_id=self._manager_id,
                    player_id=interest.player.id,
                    gameweek=self.gameweek.number,
                    status="active",
                    note=interest.note or "",
                    created_at=now,
                    updated_at=now,
                )
            )
            session.commit()
        return interest

    def delete_interest(self, interest_id: str) -> bool:
        with self._session_factory() as session:
            result = session.execute(
                update(squad_interests_table)
                .where(squad_interests_table.c.id == interest_id)
                .values(status="deleted", updated_at=datetime.now(UTC))
            )
            session.commit()
        return result.rowcount > 0

    def list_trades(self) -> list[TradeProposal]:
        with self._session_factory() as session:
            trade_ids = list(
                session.execute(
                    select(trade_proposals_table.c.id)
                    .where(
                        or_(
                            trade_proposals_table.c.offered_by_team_id == self.manager_team.id,
                            trade_proposals_table.c.offered_to_team_id == self.manager_team.id,
                        )
                    )
                    .order_by(trade_proposals_table.c.created_at)
                ).scalars()
            )
        trades = [self._get_trade(trade_id) for trade_id in trade_ids]
        return [trade for trade in trades if trade is not None]

    def get_trade(self, trade_id: str) -> TradeProposal | None:
        return self._get_trade(trade_id)

    def list_pending_trade_approvals(self, actor_user_id: str) -> list[TradeProposal]:
        with self._session_factory() as session:
            actor_manager_id = session.execute(
                select(managers_table.c.id).where(
                    or_(
                        managers_table.c.user_id == actor_user_id,
                        managers_table.c.id == actor_user_id,
                    )
                )
            ).scalar_one_or_none()
            if actor_manager_id is None:
                return []
            rows = list(
                session.execute(
                    select(
                        trade_proposals_table.c.id,
                        trade_proposals_table.c.offered_by_team_id,
                        trade_proposals_table.c.offered_to_team_id,
                        trade_proposals_table.c.required_approver_role,
                    )
                    .where(
                        trade_proposals_table.c.status == TradeStatus.ACCEPTED.value,
                        trade_proposals_table.c.approval_status
                        == TradeApprovalStatus.PENDING.value,
                    )
                    .order_by(trade_proposals_table.c.created_at)
                ).mappings()
            )
            visible_ids: list[str] = []
            for row in rows:
                team_ids = [row["offered_by_team_id"], row["offered_to_team_id"]]
                participant_managers = set(
                    session.execute(
                        select(draft_teams_table.c.manager_id).where(
                            draft_teams_table.c.id.in_(team_ids),
                            draft_teams_table.c.manager_id.is_not(None),
                        )
                    ).scalars()
                )
                if actor_manager_id in participant_managers:
                    continue
                league_id = session.execute(
                    select(draft_teams_table.c.league_id).where(
                        draft_teams_table.c.id == row["offered_by_team_id"]
                    )
                ).scalar_one_or_none()
                if league_id is None:
                    continue
                actor_roles = set(
                    session.execute(
                        select(league_memberships_table.c.role).where(
                            league_memberships_table.c.league_id == league_id,
                            league_memberships_table.c.manager_id == actor_manager_id,
                        )
                    ).scalars()
                )
                participant_roles = set(
                    session.execute(
                        select(league_memberships_table.c.role).where(
                            league_memberships_table.c.league_id == league_id,
                            league_memberships_table.c.manager_id.in_(participant_managers),
                        )
                    ).scalars()
                )
                required_role = row["required_approver_role"] or (
                    "vice_commissioner" if "commissioner" in participant_roles else "commissioner"
                )
                if required_role in actor_roles:
                    visible_ids.append(str(row["id"]))
        trades = [self._get_trade(trade_id) for trade_id in visible_ids]
        return [trade for trade in trades if trade is not None]

    def trade_audit(
        self, trade_id: str, actor_user_id: str
    ) -> list[TradeAuditEventResponse] | None:
        with self._session_factory() as session:
            trade = (
                session.execute(
                    select(
                        trade_proposals_table.c.offered_by_team_id,
                        trade_proposals_table.c.offered_to_team_id,
                        trade_proposals_table.c.required_approver_role,
                    ).where(trade_proposals_table.c.id == trade_id)
                )
                .mappings()
                .first()
            )
            if trade is None:
                return None
            actor_manager_id = session.execute(
                select(managers_table.c.id).where(
                    or_(
                        managers_table.c.user_id == actor_user_id,
                        managers_table.c.id == actor_user_id,
                    )
                )
            ).scalar_one_or_none()
            if actor_manager_id is None:
                return None
            participants = set(
                session.execute(
                    select(draft_teams_table.c.manager_id).where(
                        draft_teams_table.c.id.in_(
                            [trade["offered_by_team_id"], trade["offered_to_team_id"]]
                        ),
                        draft_teams_table.c.manager_id.is_not(None),
                    )
                ).scalars()
            )
            allowed = actor_manager_id in participants
            if not allowed:
                league_id = session.execute(
                    select(draft_teams_table.c.league_id).where(
                        draft_teams_table.c.id == trade["offered_by_team_id"]
                    )
                ).scalar_one_or_none()
                if league_id is None:
                    return None
                actor_roles = set(
                    session.execute(
                        select(league_memberships_table.c.role).where(
                            league_memberships_table.c.league_id == league_id,
                            league_memberships_table.c.manager_id == actor_manager_id,
                        )
                    ).scalars()
                )
                participant_roles = set(
                    session.execute(
                        select(league_memberships_table.c.role).where(
                            league_memberships_table.c.league_id == league_id,
                            league_memberships_table.c.manager_id.in_(participants),
                        )
                    ).scalars()
                )
                required_role = trade["required_approver_role"] or (
                    "vice_commissioner" if "commissioner" in participant_roles else "commissioner"
                )
                allowed = required_role in actor_roles
            if not allowed:
                return None
            rows = list(
                session.execute(
                    select(squad_audit_events_table)
                    .where(
                        squad_audit_events_table.c.subject_type == "trade",
                        squad_audit_events_table.c.subject_id == trade_id,
                    )
                    .order_by(squad_audit_events_table.c.created_at)
                ).mappings()
            )
        return [
            TradeAuditEventResponse(
                id=str(row["id"]),
                subject_type=str(row["subject_type"]),
                subject_id=str(row["subject_id"]),
                action=str(row["action"]),
                actor_manager_id=row["actor_manager_id"],
                created_at=row["created_at"],
                metadata=dict(row["metadata_json"] or {}),
            )
            for row in rows
        ]

    def save_trade(self, trade: TradeProposal) -> TradeProposal:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            session.execute(
                insert(trade_proposals_table).values(
                    id=trade.id,
                    season_id=DEMO_SEASON_ID,
                    offered_by_team_id=trade.offered_by.id,
                    offered_to_team_id=trade.offered_to.id,
                    gameweek=self.gameweek.number,
                    status=trade.status.value,
                    approval_status=trade.approval_status.value,
                    required_approver_role=trade.required_approver_role,
                    approved_by_manager_id=trade.approved_by,
                    executed_at=trade.executed_at,
                    created_at=now,
                    updated_at=now,
                )
            )
            for asset in trade.assets:
                session.execute(
                    insert(trade_assets_table).values(
                        id=f"trade-asset-{uuid4().hex[:8]}",
                        trade_id=trade.id,
                        player_id=asset.player.id,
                        from_team_id=asset.from_team.id,
                        to_team_id=asset.to_team.id,
                    )
                )
            session.execute(
                insert(squad_audit_events_table).values(
                    id=f"squad-audit-{uuid4().hex[:12]}",
                    subject_type="trade",
                    subject_id=trade.id,
                    action="trade_proposed",
                    actor_manager_id=self._manager_id,
                    created_at=now,
                    metadata_json={},
                )
            )
            session.commit()
        return trade

    def manager_id_for_team(self, team_id: str) -> str | None:
        with self._session_factory() as session:
            return session.execute(
                select(managers_table.c.user_id)
                .join(managers_table, managers_table.c.id == draft_teams_table.c.manager_id)
                .where(draft_teams_table.c.id == team_id)
            ).scalar_one_or_none()

    def required_trade_approver_role(self, offered_by_team_id: str, offered_to_team_id: str) -> str:
        with self._session_factory() as session:
            roles = list(
                session.execute(
                    select(league_memberships_table.c.role)
                    .join(
                        draft_teams_table,
                        draft_teams_table.c.league_id == league_memberships_table.c.league_id,
                    )
                    .where(
                        draft_teams_table.c.id.in_([offered_by_team_id, offered_to_team_id]),
                        draft_teams_table.c.manager_id == league_memberships_table.c.manager_id,
                    )
                ).scalars()
            )
        return "vice_commissioner" if "commissioner" in roles else "commissioner"

    def team_for_id(self, team_id: str) -> TeamSummary | None:
        if team_id == self.manager_team.id:
            return self.manager_team
        if team_id == self.rival_team.id:
            return self.rival_team
        with self._session_factory() as session:
            league_id = session.execute(
                select(draft_teams_table.c.league_id).where(
                    draft_teams_table.c.id == self.manager_team.id
                )
            ).scalar_one_or_none()
            if league_id is None:
                return None
            row = (
                session.execute(
                    select(draft_teams_table.c.id, draft_teams_table.c.name).where(
                        draft_teams_table.c.id == team_id,
                        draft_teams_table.c.league_id == league_id,
                    )
                )
                .mappings()
                .first()
            )
        return None if row is None else TeamSummary(id=str(row["id"]), name=str(row["name"]))

    def update_trade_status(
        self,
        trade_id: str,
        status: TradeStatus,
        actor_user_id: str,
    ) -> TradeProposal | None:
        with self._session_factory() as session:
            with session.begin():
                result = session.execute(
                    update(trade_proposals_table)
                    .where(
                        trade_proposals_table.c.id == trade_id,
                        trade_proposals_table.c.status == TradeStatus.PROPOSED.value,
                    )
                    .values(
                        status=status.value,
                        approval_status=(
                            TradeApprovalStatus.PENDING.value
                            if status == TradeStatus.ACCEPTED
                            else TradeApprovalStatus.NOT_SUBMITTED.value
                        ),
                        updated_at=datetime.now(UTC),
                    )
                )
                if result.rowcount:
                    actor_manager_id = session.execute(
                        select(managers_table.c.id)
                        .where(
                            or_(
                                managers_table.c.user_id == actor_user_id,
                                managers_table.c.id == actor_user_id,
                            )
                        )
                        .limit(1)
                    ).scalar_one_or_none()
                    session.execute(
                        insert(squad_audit_events_table).values(
                            id=f"squad-audit-{uuid4().hex[:12]}",
                            subject_type="trade",
                            subject_id=trade_id,
                            action={
                                TradeStatus.ACCEPTED: "trade_agreed",
                                TradeStatus.REJECTED: "trade_rejected_by_party",
                                TradeStatus.CANCELLED: "trade_cancelled",
                            }[status],
                            actor_manager_id=actor_manager_id,
                            created_at=datetime.now(UTC),
                            metadata_json={},
                        )
                    )
        if result.rowcount == 0:
            return self._get_trade(trade_id)
        return self._get_trade(trade_id)

    def approve_trade(
        self,
        trade_id: str,
        actor_user_id: str,
        decision: TradeApprovalDecision,
        note: str | None,
    ) -> TradeProposal | None:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            with session.begin():
                trade_summary = (
                    session.execute(
                        select(
                            trade_proposals_table.c.season_id,
                            trade_proposals_table.c.id,
                        ).where(trade_proposals_table.c.id == trade_id)
                    )
                    .mappings()
                    .first()
                )
                if trade_summary is None:
                    return None
                season_exists = session.execute(
                    select(seasons_table.c.id)
                    .where(seasons_table.c.id == trade_summary["season_id"])
                    .with_for_update()
                ).scalar_one_or_none()
                if season_exists is None:
                    raise ValueError("The trade season is not configured.")
                trade = (
                    session.execute(
                        select(trade_proposals_table)
                        .where(trade_proposals_table.c.id == trade_id)
                        .with_for_update()
                    )
                    .mappings()
                    .first()
                )
                if trade is None:
                    return None
                actor_manager_id = session.execute(
                    select(managers_table.c.id)
                    .where(
                        or_(
                            managers_table.c.user_id == actor_user_id,
                            managers_table.c.id == actor_user_id,
                        )
                    )
                    .limit(1)
                ).scalar_one_or_none()
                if actor_manager_id is None:
                    raise ValueError("Approver must be a league member.")
                involved_manager_ids = set(
                    session.execute(
                        select(draft_teams_table.c.manager_id).where(
                            draft_teams_table.c.id.in_(
                                [trade["offered_by_team_id"], trade["offered_to_team_id"]]
                            ),
                            draft_teams_table.c.manager_id.is_not(None),
                        )
                    ).scalars()
                )
                if actor_manager_id in involved_manager_ids:
                    raise ValueError("A trade participant cannot approve their own trade.")

                league_id = session.execute(
                    select(draft_teams_table.c.league_id).where(
                        draft_teams_table.c.id == trade["offered_by_team_id"]
                    )
                ).scalar_one()
                actor_roles = set(
                    session.execute(
                        select(league_memberships_table.c.role).where(
                            league_memberships_table.c.league_id == league_id,
                            league_memberships_table.c.manager_id == actor_manager_id,
                        )
                    ).scalars()
                )
                party_roles = set(
                    session.execute(
                        select(league_memberships_table.c.role).where(
                            league_memberships_table.c.league_id == league_id,
                            league_memberships_table.c.manager_id.in_(involved_manager_ids),
                        )
                    ).scalars()
                )
                required_role = str(
                    trade["required_approver_role"]
                    or ("vice_commissioner" if "commissioner" in party_roles else "commissioner")
                )
                if required_role not in actor_roles:
                    raise ValueError(f"Trade requires a {required_role} approver.")
                if (
                    trade["status"] == TradeStatus.ACCEPTED.value
                    and trade["approval_status"] == TradeApprovalStatus.APPROVED.value
                ):
                    return self._get_trade(trade_id)
                if (
                    trade["status"] != TradeStatus.ACCEPTED.value
                    or trade["approval_status"] != TradeApprovalStatus.PENDING.value
                ):
                    raise ValueError("Trade is not waiting for approval.")

                approval_status = (
                    TradeApprovalStatus.APPROVED
                    if decision == TradeApprovalDecision.APPROVED
                    else TradeApprovalStatus.REJECTED
                )
                if decision == TradeApprovalDecision.APPROVED:
                    ensure_squad_moves_allowed(session, str(trade["season_id"]))
                    assets = list(
                        session.execute(
                            select(trade_assets_table).where(
                                trade_assets_table.c.trade_id == trade_id
                            )
                        ).mappings()
                    )
                    asset_player_ids = [str(asset["player_id"]) for asset in assets]
                    if not assets:
                        raise ValueError("Trade has no transferable assets.")
                    if len(asset_player_ids) != len(set(asset_player_ids)):
                        raise ValueError("Trade assets must be unique.")
                    valid_directions = {
                        (trade["offered_by_team_id"], trade["offered_to_team_id"]),
                        (trade["offered_to_team_id"], trade["offered_by_team_id"]),
                    }
                    changed_team_ids = {
                        str(team_id)
                        for asset in assets
                        for team_id in (asset["from_team_id"], asset["to_team_id"])
                    }
                    if any(
                        (asset["from_team_id"], asset["to_team_id"]) not in valid_directions
                        for asset in assets
                    ):
                        raise ValueError("Trade asset has an invalid team direction.")
                    if {
                        (asset["from_team_id"], asset["to_team_id"]) for asset in assets
                    } != valid_directions:
                        raise ValueError("Trade must include assets for both participating teams.")
                    session.execute(
                        select(draft_teams_table.c.id)
                        .where(draft_teams_table.c.id.in_(changed_team_ids))
                        .order_by(draft_teams_table.c.id)
                        .with_for_update()
                    ).all()
                    transfers: list[tuple[object, object, str]] = []
                    for asset in assets:
                        active_loan = session.execute(
                            select(loans_table.c.id).where(
                                loans_table.c.season_id == trade["season_id"],
                                loans_table.c.player_id == asset["player_id"],
                                loans_table.c.status == "active",
                            )
                        ).scalar_one_or_none()
                        if active_loan is not None:
                            raise ValueError("An active loan player cannot be traded.")
                        ownerships = list(
                            session.execute(
                                select(squad_ownerships_table)
                                .where(
                                    squad_ownerships_table.c.season_id == trade["season_id"],
                                    squad_ownerships_table.c.draft_team_id == asset["from_team_id"],
                                    squad_ownerships_table.c.player_id == asset["player_id"],
                                    squad_ownerships_table.c.ended_at.is_(None),
                                )
                                .with_for_update()
                            ).mappings()
                        )
                        if len(ownerships) != 1:
                            raise ValueError("Trade asset is no longer owned by its offering team.")
                        ownership = ownerships[0]
                        position_id = session.execute(
                            select(fpl_players_table.c.position_id).where(
                                fpl_players_table.c.id == asset["player_id"]
                            )
                        ).scalar_one_or_none()
                        if position_id is None:
                            raise ValueError("Trade asset position could not be verified.")
                        transfers.append((asset, ownership, str(position_id)))
                    for _, ownership, _ in transfers:
                        session.execute(
                            update(squad_ownerships_table)
                            .where(squad_ownerships_table.c.id == ownership["id"])
                            .values(ended_at=now)
                        )
                    for asset, _, position_id in transfers:
                        session.execute(
                            insert(squad_ownerships_table).values(
                                id=f"ownership-trade-{uuid4().hex[:12]}",
                                season_id=trade["season_id"],
                                draft_team_id=asset["to_team_id"],
                                player_id=asset["player_id"],
                                roster_slot_id=self._available_roster_slot(
                                    session,
                                    str(asset["to_team_id"]),
                                    trade["season_id"],
                                    position_id,
                                ),
                                started_at=now,
                                ended_at=None,
                            )
                        )

                    for team_id in changed_team_ids:
                        team_players = list(
                            session.execute(
                                select(fpl_positions_table.c.singular_name)
                                .select_from(
                                    squad_ownerships_table.join(
                                        fpl_players_table,
                                        fpl_players_table.c.id
                                        == squad_ownerships_table.c.player_id,
                                    ).join(
                                        fpl_positions_table,
                                        fpl_positions_table.c.id == fpl_players_table.c.position_id,
                                    )
                                )
                                .where(
                                    squad_ownerships_table.c.season_id == trade["season_id"],
                                    squad_ownerships_table.c.draft_team_id == team_id,
                                    squad_ownerships_table.c.ended_at.is_(None),
                                )
                            ).scalars()
                        )
                        team_players.extend(
                            session.execute(
                                select(fpl_positions_table.c.singular_name)
                                .select_from(
                                    loans_table.join(
                                        fpl_players_table,
                                        fpl_players_table.c.id == loans_table.c.player_id,
                                    ).join(
                                        fpl_positions_table,
                                        fpl_positions_table.c.id == fpl_players_table.c.position_id,
                                    )
                                )
                                .where(
                                    loans_table.c.season_id == trade["season_id"],
                                    loans_table.c.lender_team_id == team_id,
                                    loans_table.c.status == "active",
                                )
                            ).scalars()
                        )
                        if len(team_players) > 20:
                            raise ValueError("Trade would exceed the 20-player squad limit.")
                        position_limits = {
                            "goalkeeper": 3,
                            "defender": 10,
                            "midfielder": 10,
                            "forward": 4,
                        }
                        position_counts = {
                            position: sum(name.casefold() == position for name in team_players)
                            for position in position_limits
                        }
                        if any(
                            position_counts[position] > maximum
                            for position, maximum in position_limits.items()
                        ):
                            raise ValueError("Trade would exceed a squad position limit.")
                        owned_ids = set(
                            session.execute(
                                select(squad_ownerships_table.c.player_id).where(
                                    squad_ownerships_table.c.season_id == trade["season_id"],
                                    squad_ownerships_table.c.draft_team_id == team_id,
                                    squad_ownerships_table.c.ended_at.is_(None),
                                )
                            ).scalars()
                        )
                        from cdl_api.repositories.postgres_team_selection import (
                            PostgreSQLTeamSelectionRepository,
                        )

                        PostgreSQLTeamSelectionRepository.repair_unlocked_lineups(
                            session, team_id, owned_ids, now
                        )

                session.execute(
                    update(trade_proposals_table)
                    .where(trade_proposals_table.c.id == trade_id)
                    .values(
                        approval_status=approval_status.value,
                        required_approver_role=required_role,
                        approved_by_manager_id=actor_manager_id,
                        executed_at=now if decision == TradeApprovalDecision.APPROVED else None,
                        updated_at=now,
                    )
                )
                session.execute(
                    insert(trade_approvals_table).values(
                        id=f"trade-approval-{uuid4().hex[:12]}",
                        trade_id=trade_id,
                        manager_id=actor_manager_id,
                        decision=decision.value,
                        note=note or "",
                        decided_at=now,
                    )
                )
                session.execute(
                    insert(squad_audit_events_table).values(
                        id=f"squad-audit-{uuid4().hex[:12]}",
                        subject_type="trade",
                        subject_id=trade_id,
                        action=(
                            "trade_executed"
                            if decision == TradeApprovalDecision.APPROVED
                            else "trade_rejected"
                        ),
                        actor_manager_id=actor_manager_id,
                        created_at=now,
                        metadata_json={"note": note or "", "required_approver_role": required_role},
                    )
                )
        self._invalidate_players_cache()
        return self._get_trade(trade_id)

    @staticmethod
    def _available_roster_slot(
        session: Session, team_id: str, season_id: str, position_id: str
    ) -> str:
        slot_id = session.execute(
            select(squad_roster_slots_table.c.id)
            .select_from(
                squad_roster_slots_table.outerjoin(
                    squad_ownerships_table,
                    and_(
                        squad_ownerships_table.c.roster_slot_id == squad_roster_slots_table.c.id,
                        squad_ownerships_table.c.season_id == season_id,
                        squad_ownerships_table.c.ended_at.is_(None),
                    ),
                )
            )
            .where(
                squad_roster_slots_table.c.season_id == season_id,
                squad_roster_slots_table.c.draft_team_id == team_id,
                or_(
                    squad_roster_slots_table.c.position_id == position_id,
                    squad_roster_slots_table.c.position_id.is_(None),
                ),
                squad_ownerships_table.c.id.is_(None),
            )
            .order_by(squad_roster_slots_table.c.sort_order)
            .limit(1)
            .with_for_update(of=squad_roster_slots_table)
        ).scalar_one_or_none()
        if slot_id is None:
            raise ValueError("No compatible squad slot is available for the incoming player.")
        return str(slot_id)

    def _get_trade(self, trade_id: str) -> TradeProposal | None:
        with self._session_factory() as session:
            trade_row = (
                session.execute(
                    select(
                        trade_proposals_table.c.id,
                        trade_proposals_table.c.status,
                        trade_proposals_table.c.offered_by_team_id,
                        trade_proposals_table.c.offered_to_team_id,
                        trade_proposals_table.c.approval_status,
                        trade_proposals_table.c.required_approver_role,
                        trade_proposals_table.c.approved_by_manager_id,
                        trade_proposals_table.c.executed_at,
                    ).where(trade_proposals_table.c.id == trade_id)
                )
                .mappings()
                .first()
            )
            asset_rows = list(
                session.execute(
                    select(
                        trade_assets_table.c.player_id,
                        trade_assets_table.c.from_team_id,
                        trade_assets_table.c.to_team_id,
                    ).where(trade_assets_table.c.trade_id == trade_id)
                ).mappings()
            )
        if trade_row is None:
            return None
        return TradeProposal(
            id=trade_row["id"],
            status=TradeStatus(trade_row["status"]),
            offered_by=self._team_for_id(trade_row["offered_by_team_id"]),
            offered_to=self._team_for_id(trade_row["offered_to_team_id"]),
            gameweek=self.gameweek,
            assets=[self._asset_from_row(row) for row in asset_rows],
            approval_status=TradeApprovalStatus(trade_row["approval_status"]),
            required_approver_role=trade_row["required_approver_role"],
            approved_by=trade_row["approved_by_manager_id"],
            executed_at=trade_row["executed_at"],
        )

    def _asset_from_row(self, row: object) -> TradeAsset:
        player = self.get_player(row["player_id"])
        if player is None:
            raise ValueError(f"Unknown trade asset player: {row['player_id']}")
        return TradeAsset(
            player=player,
            from_team=self._team_for_id(row["from_team_id"]),
            to_team=self._team_for_id(row["to_team_id"]),
        )

    def _team_for_id(self, team_id: str) -> TeamSummary:
        if team_id == self.manager_team.id:
            return self.manager_team
        if team_id == self.rival_team.id:
            return self.rival_team
        return TeamSummary(id=team_id, name=team_id)
