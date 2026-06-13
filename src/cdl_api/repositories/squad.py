"""Squad repositories for feature development and production-backed persistence."""

from copy import deepcopy
from typing import Protocol

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.squad import (
    InterestResponse,
    PlayerDetail,
    PlayerMetric,
    PlayerOwnershipStatus,
    PlayerPosition,
    ScoutingFilters,
    TradeProposal,
    TradeStatus,
)


class SquadRepository(Protocol):
    manager_team: TeamSummary
    rival_team: TeamSummary
    gameweek: GameweekSummary

    def list_squad_players(self) -> list[PlayerDetail]: ...

    def list_players(self, filters: ScoutingFilters) -> list[PlayerDetail]: ...

    def get_player(self, player_id: str) -> PlayerDetail | None: ...

    def save_interest(self, interest: InterestResponse) -> InterestResponse: ...

    def delete_interest(self, interest_id: str) -> bool: ...

    def list_trades(self) -> list[TradeProposal]: ...

    def save_trade(self, trade: TradeProposal) -> TradeProposal: ...

    def update_trade_status(self, trade_id: str, status: TradeStatus) -> TradeProposal | None: ...


class InMemorySquadRepository:
    def __init__(self) -> None:
        self.manager_team = TeamSummary(id="team-castle", name="Castle FC")
        self.rival_team = TeamSummary(id="team-rival", name="Rival Town")
        self.gameweek = GameweekSummary(id="gw-1", name="Gameweek 1", number=1)
        arsenal = TeamSummary(id="epl-ars", name="Arsenal")
        city = TeamSummary(id="epl-mci", name="Manchester City")
        self._players = [
            self._make(
                "player-1",
                "Alex Keeper",
                PlayerPosition.GOALKEEPER,
                arsenal,
                self.manager_team,
                PlayerOwnershipStatus.OWNED,
                42,
                5.4,
                5.0,
            ),
            self._make(
                "player-2",
                "Ben Defender",
                PlayerPosition.DEFENDER,
                city,
                self.manager_team,
                PlayerOwnershipStatus.OWNED,
                55,
                6.1,
                6.0,
            ),
            self._make(
                "player-3",
                "Casey Midfielder",
                PlayerPosition.MIDFIELDER,
                arsenal,
                None,
                PlayerOwnershipStatus.AVAILABLE,
                61,
                7.2,
                7.5,
            ),
            self._make(
                "player-4",
                "Riley Forward",
                PlayerPosition.FORWARD,
                city,
                self.rival_team,
                PlayerOwnershipStatus.TRADE_TARGET,
                70,
                8.0,
                9.0,
            ),
        ]
        self._interests: dict[str, InterestResponse] = {}
        self._trades: dict[str, TradeProposal] = {}

    def _make(
        self,
        player_id: str,
        name: str,
        position: PlayerPosition,
        epl_team: TeamSummary,
        draft_team: TeamSummary | None,
        status: PlayerOwnershipStatus,
        points: int,
        form: float,
        value: float,
    ) -> PlayerDetail:
        return PlayerDetail(
            id=player_id,
            display_name=name,
            position=position,
            team=epl_team,
            epl_team=epl_team,
            draft_team=draft_team,
            status=status,
            points=points,
            form=form,
            value=value,
        )

    def list_squad_players(self) -> list[PlayerDetail]:
        return [deepcopy(player) for player in self._players if player.draft_team]

    def list_players(self, filters: ScoutingFilters) -> list[PlayerDetail]:
        players = deepcopy(self._players)
        if filters.position is not None:
            players = [player for player in players if player.position == filters.position]
        if filters.query:
            query = filters.query.lower()
            players = [player for player in players if query in player.display_name.lower()]
        metric = "points"
        if filters.metric != PlayerMetric.TOTAL_POINTS:
            metric = filters.metric.value
        return sorted(players, key=lambda player: getattr(player, metric), reverse=True)

    def get_player(self, player_id: str) -> PlayerDetail | None:
        for player in self._players:
            if player.id == player_id:
                return deepcopy(player)
        return None

    def save_interest(self, interest: InterestResponse) -> InterestResponse:
        self._interests[interest.id] = deepcopy(interest)
        return deepcopy(interest)

    def delete_interest(self, interest_id: str) -> bool:
        return self._interests.pop(interest_id, None) is not None

    def list_trades(self) -> list[TradeProposal]:
        return [deepcopy(trade) for trade in self._trades.values()]

    def save_trade(self, trade: TradeProposal) -> TradeProposal:
        self._trades[trade.id] = deepcopy(trade)
        return deepcopy(trade)

    def update_trade_status(self, trade_id: str, status: TradeStatus) -> TradeProposal | None:
        trade = self._trades.get(trade_id)
        if trade is None:
            return None
        trade.status = status
        return deepcopy(trade)
