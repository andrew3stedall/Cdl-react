"""Read-only league data repository for companion applications."""

from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from cdl_api.repositories.live_draft import live_draft_picks_table, live_drafts_table
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    fpl_players_table,
    managers_table,
)
from cdl_api.repositories.postgres_squad import (
    free_agency_draws_table,
    free_agency_results_table,
    squad_ownerships_table,
    trade_assets_table,
    trade_proposals_table,
)
from cdl_api.repositories.postgres_team_selection import team_selection_lineup_slots_table
from cdl_api.staging_draft_seed import LEAGUE_ID, SEASON_ID


class CompanionDataRepository:
    """Expose only league-wide data intended for read-only companion clients."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def teams(self) -> list[dict[str, str | None]]:
        with self._session_factory() as session:
            rows = (
                session.execute(
                    select(
                        draft_teams_table.c.id,
                        draft_teams_table.c.name,
                        managers_table.c.display_name,
                    )
                    .outerjoin(
                        managers_table,
                        managers_table.c.id == draft_teams_table.c.manager_id,
                    )
                    .where(draft_teams_table.c.league_id == LEAGUE_ID)
                    .order_by(draft_teams_table.c.name)
                )
                .mappings()
                .all()
            )
            return [
                {"id": row["id"], "name": row["name"], "manager_name": row["display_name"]}
                for row in rows
            ]

    def draft_picks(self) -> dict[str, object]:
        with self._session_factory() as session:
            draft = (
                session.execute(
                    select(live_drafts_table)
                    .where(
                        live_drafts_table.c.league_id == LEAGUE_ID,
                        live_drafts_table.c.season_id == SEASON_ID,
                    )
                    .limit(1)
                )
                .mappings()
                .one_or_none()
            )
            rows = (
                session.execute(
                    select(
                        live_draft_picks_table.c.pick_index,
                        live_draft_picks_table.c.round_number,
                        live_draft_picks_table.c.team_id,
                        draft_teams_table.c.name.label("team_name"),
                        live_draft_picks_table.c.player_id,
                        fpl_players_table.c.web_name.label("player_name"),
                        live_draft_picks_table.c.picked_at,
                        live_draft_picks_table.c.source,
                    )
                    .join(
                        draft_teams_table,
                        draft_teams_table.c.id == live_draft_picks_table.c.team_id,
                    )
                    .join(
                        fpl_players_table,
                        fpl_players_table.c.id == live_draft_picks_table.c.player_id,
                    )
                    .where(
                        live_draft_picks_table.c.draft_id == draft["id"]
                        if draft is not None
                        else live_draft_picks_table.c.draft_id == ""
                    )
                    .order_by(live_draft_picks_table.c.pick_index)
                )
                .mappings()
                .all()
            )
            if not rows:
                # The active historical seed stores the captured overall pick
                # number in stable ownership IDs rather than live-draft rows.
                seeded = (
                    session.execute(
                        select(
                            squad_ownerships_table.c.id,
                            squad_ownerships_table.c.draft_team_id,
                            draft_teams_table.c.name.label("team_name"),
                            squad_ownerships_table.c.player_id,
                            fpl_players_table.c.web_name.label("player_name"),
                            squad_ownerships_table.c.started_at.label("picked_at"),
                        )
                        .join(
                            draft_teams_table,
                            draft_teams_table.c.id == squad_ownerships_table.c.draft_team_id,
                        )
                        .join(
                            fpl_players_table,
                            fpl_players_table.c.id == squad_ownerships_table.c.player_id,
                        )
                        .where(
                            squad_ownerships_table.c.season_id == SEASON_ID,
                            squad_ownerships_table.c.id.like("ownership-pick-%"),
                        )
                    )
                    .mappings()
                    .all()
                )
                team_count = len(
                    session.execute(
                        select(draft_teams_table.c.id).where(
                            draft_teams_table.c.league_id == LEAGUE_ID
                        )
                    )
                    .scalars()
                    .all()
                )
                picks = []
                for row in seeded:
                    try:
                        pick_number = int(row["id"].removeprefix("ownership-pick-"))
                    except ValueError:
                        continue
                    picks.append(
                        {
                            "pick_number": pick_number,
                            "round_number": (pick_number - 1) // max(team_count, 1) + 1,
                            "team_id": row["draft_team_id"],
                            "team_name": row["team_name"],
                            "player_id": row["player_id"],
                            "player_name": row["player_name"],
                            "picked_at": row["picked_at"],
                            "source": "historical_seed",
                        }
                    )
                picks.sort(key=lambda pick: pick["pick_number"])
                return {
                    "draft_id": draft["id"] if draft is not None else "historical-seed",
                    "status": draft["status"] if draft is not None else "complete",
                    "picks": picks,
                }
            return {
                "draft_id": draft["id"] if draft is not None else None,
                "status": draft["status"] if draft is not None else None,
                "picks": [
                    {
                        "pick_number": row["pick_index"] + 1,
                        "round_number": row["round_number"],
                        "team_id": row["team_id"],
                        "team_name": row["team_name"],
                        "player_id": row["player_id"],
                        "player_name": row["player_name"],
                        "picked_at": row["picked_at"],
                        "source": row["source"],
                    }
                    for row in rows
                ],
            }

    def draw_results(self) -> list[dict[str, object]]:
        with self._session_factory() as session:
            draws = (
                session.execute(
                    select(
                        free_agency_draws_table.c.id,
                        free_agency_draws_table.c.gameweek,
                        free_agency_draws_table.c.status,
                        free_agency_draws_table.c.processed_at,
                    )
                    .where(
                        free_agency_draws_table.c.season_id == SEASON_ID,
                        free_agency_draws_table.c.status == "processed",
                    )
                    .order_by(free_agency_draws_table.c.gameweek)
                )
                .mappings()
                .all()
            )
            results: list[dict[str, object]] = []
            for draw in draws:
                awards = (
                    session.execute(
                        select(
                            free_agency_results_table.c.draft_team_id,
                            draft_teams_table.c.name.label("team_name"),
                            free_agency_results_table.c.player_id,
                            fpl_players_table.c.web_name.label("player_name"),
                            free_agency_results_table.c.preference_rank,
                            free_agency_results_table.c.reason_code,
                        )
                        .join(
                            draft_teams_table,
                            draft_teams_table.c.id == free_agency_results_table.c.draft_team_id,
                        )
                        .outerjoin(
                            fpl_players_table,
                            fpl_players_table.c.id == free_agency_results_table.c.player_id,
                        )
                        .where(free_agency_results_table.c.draw_id == draw["id"])
                        .order_by(draft_teams_table.c.name)
                    )
                    .mappings()
                    .all()
                )
                results.append(
                    {
                        "draw_id": draw["id"],
                        "gameweek": draw["gameweek"],
                        "status": draw["status"],
                        "processed_at": draw["processed_at"],
                        "awards": [
                            {
                                "team_id": row["draft_team_id"],
                                "team_name": row["team_name"],
                                "player_id": row["player_id"],
                                "player_name": row["player_name"],
                                "preference_rank": row["preference_rank"],
                                "reason_code": row["reason_code"],
                            }
                            for row in awards
                        ],
                    }
                )
            return results

    def squad_movements(self) -> list[dict[str, object]]:
        with self._session_factory() as session:
            rows = (
                session.execute(
                    select(
                        squad_ownerships_table.c.id,
                        squad_ownerships_table.c.started_at,
                        squad_ownerships_table.c.ended_at,
                        squad_ownerships_table.c.draft_team_id,
                        draft_teams_table.c.name.label("team_name"),
                        squad_ownerships_table.c.player_id,
                        fpl_players_table.c.web_name.label("player_name"),
                    )
                    .join(
                        draft_teams_table,
                        draft_teams_table.c.id == squad_ownerships_table.c.draft_team_id,
                    )
                    .join(
                        fpl_players_table,
                        fpl_players_table.c.id == squad_ownerships_table.c.player_id,
                    )
                    .where(squad_ownerships_table.c.season_id == SEASON_ID)
                )
                .mappings()
                .all()
            )
            movements: list[dict[str, object]] = []
            for row in rows:
                base = {
                    "team_id": row["draft_team_id"],
                    "team_name": row["team_name"],
                    "player_id": row["player_id"],
                    "player_name": row["player_name"],
                }
                movements.append(
                    {
                        "id": f"{row['id']}:added",
                        "event": "added",
                        "occurred_at": row["started_at"],
                        **base,
                    }
                )
                if row["ended_at"] is not None:
                    movements.append(
                        {
                            "id": f"{row['id']}:removed",
                            "event": "removed",
                            "occurred_at": row["ended_at"],
                            **base,
                        }
                    )
            movements.sort(key=lambda row: (row["occurred_at"], row["id"]))
            return movements

    def trades(self) -> list[dict[str, object]]:
        with self._session_factory() as session:
            trades = (
                session.execute(
                    select(
                        trade_proposals_table.c.id,
                        trade_proposals_table.c.gameweek,
                        trade_proposals_table.c.executed_at,
                    )
                    .where(
                        trade_proposals_table.c.season_id == SEASON_ID,
                        trade_proposals_table.c.status == "accepted",
                        trade_proposals_table.c.approval_status == "approved",
                        trade_proposals_table.c.executed_at.is_not(None),
                    )
                    .order_by(trade_proposals_table.c.executed_at)
                )
                .mappings()
                .all()
            )
            results: list[dict[str, object]] = []
            for trade in trades:
                assets = (
                    session.execute(
                        select(
                            trade_assets_table.c.player_id,
                            fpl_players_table.c.web_name.label("player_name"),
                            trade_assets_table.c.from_team_id,
                            trade_from_team.c.name.label("from_team_name"),
                            trade_assets_table.c.to_team_id,
                            trade_to_team.c.name.label("to_team_name"),
                        )
                        .join(
                            fpl_players_table,
                            fpl_players_table.c.id == trade_assets_table.c.player_id,
                        )
                        .join(
                            trade_from_team,
                            trade_from_team.c.id == trade_assets_table.c.from_team_id,
                        )
                        .join(trade_to_team, trade_to_team.c.id == trade_assets_table.c.to_team_id)
                        .where(trade_assets_table.c.trade_id == trade["id"])
                    )
                    .mappings()
                    .all()
                )
                results.append(
                    {
                        "id": trade["id"],
                        "gameweek": trade["gameweek"],
                        "executed_at": trade["executed_at"],
                        "assets": [dict(asset) for asset in assets],
                    }
                )
            return results

    def team_selections(self, gameweek: int | None = None) -> dict[str, object]:
        with self._session_factory() as session:
            if gameweek is None:
                gameweek = session.execute(
                    select(team_selection_lineup_slots_table.c.gameweek)
                    .where(
                        team_selection_lineup_slots_table.c.season_id == SEASON_ID,
                        team_selection_lineup_slots_table.c.locked_at.is_not(None),
                    )
                    .order_by(team_selection_lineup_slots_table.c.gameweek.desc())
                    .limit(1)
                ).scalar_one_or_none()
            if gameweek is None:
                return {"gameweek": None, "selections": []}
            rows = (
                session.execute(
                    select(
                        team_selection_lineup_slots_table.c.draft_team_id,
                        draft_teams_table.c.name.label("team_name"),
                        team_selection_lineup_slots_table.c.gameweek,
                        team_selection_lineup_slots_table.c.locked_at,
                        team_selection_lineup_slots_table.c.player_id,
                        fpl_players_table.c.web_name.label("player_name"),
                        fpl_players_table.c.position_id.label("position"),
                        team_selection_lineup_slots_table.c.slot,
                        team_selection_lineup_slots_table.c.slot_order,
                        team_selection_lineup_slots_table.c.is_captain,
                        team_selection_lineup_slots_table.c.is_vice_captain,
                    )
                    .join(
                        draft_teams_table,
                        draft_teams_table.c.id == team_selection_lineup_slots_table.c.draft_team_id,
                    )
                    .join(
                        fpl_players_table,
                        fpl_players_table.c.id == team_selection_lineup_slots_table.c.player_id,
                    )
                    .where(
                        team_selection_lineup_slots_table.c.season_id == SEASON_ID,
                        team_selection_lineup_slots_table.c.gameweek == gameweek,
                        team_selection_lineup_slots_table.c.locked_at.is_not(None),
                    )
                    .order_by(
                        draft_teams_table.c.name,
                        team_selection_lineup_slots_table.c.slot,
                        team_selection_lineup_slots_table.c.slot_order,
                    )
                )
                .mappings()
                .all()
            )
            grouped: dict[str, dict[str, object]] = {}
            for row in rows:
                team_id = row["draft_team_id"]
                selection = grouped.setdefault(
                    team_id,
                    {
                        "team_id": team_id,
                        "team_name": row["team_name"],
                        "gameweek": gameweek,
                        "locked_at": row["locked_at"],
                        "players": [],
                    },
                )
                selection["players"].append(
                    {
                        "player_id": row["player_id"],
                        "player_name": row["player_name"],
                        "position": row["position"],
                        "slot": row["slot"],
                        "slot_order": row["slot_order"],
                        "is_captain": row["is_captain"],
                        "is_vice_captain": row["is_vice_captain"],
                    }
                )
            return {"gameweek": gameweek, "selections": list(grouped.values())}


# Alias the team table twice to resolve each direction of a trade asset.

trade_from_team = draft_teams_table.alias("trade_from_team")
trade_to_team = draft_teams_table.alias("trade_to_team")
