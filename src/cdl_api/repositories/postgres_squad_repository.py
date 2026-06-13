"""PostgreSQL-backed squad interest and trade repository."""

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import insert, select, update
from sqlalchemy.orm import Session

from cdl_api.contracts.domain import TeamSummary
from cdl_api.contracts.squad import (
    InterestResponse,
    PlayerDetail,
    ScoutingFilters,
    TradeAsset,
    TradeProposal,
    TradeStatus,
)
from cdl_api.repositories.postgres_squad import (
    squad_interests_table,
    trade_assets_table,
    trade_proposals_table,
)
from cdl_api.repositories.squad import InMemorySquadRepository

DEMO_SEASON_ID = "season-2026"
DEMO_MANAGER_ID = "manager-1"


class PostgreSQLSquadRepository(InMemorySquadRepository):
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        super().__init__()
        self._session_factory = session_factory

    def seed_demo_data(self) -> None:
        """Seed hooks are owned by imports in #69; runtime writes are persisted here."""

    def list_players(self, filters: ScoutingFilters) -> list[PlayerDetail]:
        players = super().list_players(filters)
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
                player.status = "interested"
        return players

    def save_interest(self, interest: InterestResponse) -> InterestResponse:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            session.execute(
                insert(squad_interests_table).values(
                    id=interest.id,
                    season_id=DEMO_SEASON_ID,
                    draft_team_id=self.manager_team.id,
                    manager_id=DEMO_MANAGER_ID,
                    player_id=interest.player.id,
                    gameweek=self.gameweek.number,
                    status="active",
                    note=interest.note or "",
                    created_at=now,
                    updated_at=now,
                )
            )
            session.commit()
        return super().save_interest(interest)

    def delete_interest(self, interest_id: str) -> bool:
        with self._session_factory() as session:
            result = session.execute(
                update(squad_interests_table)
                .where(squad_interests_table.c.id == interest_id)
                .values(status="deleted", updated_at=datetime.now(UTC))
            )
            session.commit()
        super().delete_interest(interest_id)
        return result.rowcount > 0

    def list_trades(self) -> list[TradeProposal]:
        with self._session_factory() as session:
            trade_ids = list(
                session.execute(
                    select(trade_proposals_table.c.id).order_by(trade_proposals_table.c.created_at)
                ).scalars()
            )
        trades = [self._get_trade(trade_id) for trade_id in trade_ids]
        return [trade for trade in trades if trade is not None]

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
            session.commit()
        return trade

    def update_trade_status(self, trade_id: str, status: TradeStatus) -> TradeProposal | None:
        with self._session_factory() as session:
            result = session.execute(
                update(trade_proposals_table)
                .where(trade_proposals_table.c.id == trade_id)
                .values(status=status.value, updated_at=datetime.now(UTC))
            )
            session.commit()
        if result.rowcount == 0:
            return None
        return self._get_trade(trade_id)

    def _get_trade(self, trade_id: str) -> TradeProposal | None:
        with self._session_factory() as session:
            trade_row = (
                session.execute(
                    select(
                        trade_proposals_table.c.id,
                        trade_proposals_table.c.status,
                        trade_proposals_table.c.offered_by_team_id,
                        trade_proposals_table.c.offered_to_team_id,
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
        )

    def _asset_from_row(self, row: object) -> TradeAsset:
        player = self.get_player(row["player_id"])
        if player is None:
            msg = f"Unknown trade asset player: {row['player_id']}"
            raise ValueError(msg)
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
