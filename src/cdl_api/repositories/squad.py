"""In-memory squad repository for feature development."""

from copy import deepcopy

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.squad import (
    PlayerDetail,
    PlayerMetric,
    PlayerOwnershipStatus,
    PlayerPosition,
    ScoutingFilters,
)


class InMemorySquadRepository:
    def __init__(self) -> None:
        self.manager_team = TeamSummary(id="team-castle", name="Castle FC", short_name="CFC")
        self.rival_team = TeamSummary(id="team-rival", name="Rival Town", short_name="RTN")
        self.gameweek = GameweekSummary(id="gw-1", name="Gameweek 1", number=1)
        arsenal = TeamSummary(id="epl-ars", name="Arsenal", short_name="ARS")
        city = TeamSummary(id="epl-mci", name="Manchester City", short_name="MCI")
        self._players = [
            PlayerDetail(
                id="player-1",
                display_name="Alex Keeper",
                position=PlayerPosition.GOALKEEPER,
                team=arsenal,
                epl_team=arsenal,
                draft_team=self.manager_team,
                status=PlayerOwnershipStatus.OWNED,
                points=42,
                form=5.4,
                value=5.0,
                selected_by_percent=18.5,
            ),
            PlayerDetail(
                id="player-2",
                display_name="Ben Defender",
                position=PlayerPosition.DEFENDER,
                team=city,
                epl_team=city,
                draft_team=self.manager_team,
                status=PlayerOwnershipStatus.OWNED,
                points=55,
                form=6.1,
                value=6.0,
                selected_by_percent=32.1,
            ),
            PlayerDetail(
                id="player-3",
                display_name="Casey Midfielder",
                position=PlayerPosition.MIDFIELDER,
                team=arsenal,
                epl_team=arsenal,
                draft_team=None,
                status=PlayerOwnershipStatus.AVAILABLE,
                points=61,
                form=7.2,
                value=7.5,
                selected_by_percent=28.3,
            ),
            PlayerDetail(
                id="player-4",
                display_name="Dev Forward",
                position=PlayerPosition.FORWARD,
                team=city,
                epl_team=city,
                draft_team=self.rival_team,
                status=PlayerOwnershipStatus.TRADE_TARGET,
                points=70,
                form=8.0,
                value=9.0,
                selected_by_percent=41.7,
            ),
        ]

    def list_squad_players(self) -> list[PlayerDetail]:
        return [
            deepcopy(player)
            for player in self._players
            if player.draft_team == self.manager_team
        ]

    def list_players(self, filters: ScoutingFilters) -> list[PlayerDetail]:
        players = deepcopy(self._players)
        if filters.position is not None:
            players = [player for player in players if player.position == filters.position]
        if filters.draft_team_id is not None:
            players = [
                player
                for player in players
                if player.draft_team and player.draft_team.id == filters.draft_team_id
            ]
        if filters.epl_team_id is not None:
            players = [player for player in players if player.epl_team.id == filters.epl_team_id]
        if filters.query:
            query = filters.query.lower()
            players = [player for player in players if query in player.display_name.lower()]
        metric_attribute = (
            "points" if filters.metric == PlayerMetric.TOTAL_POINTS else filters.metric.value
        )
        return sorted(players, key=lambda player: getattr(player, metric_attribute), reverse=True)

    def get_player(self, player_id: str) -> PlayerDetail | None:
        return deepcopy(next((player for player in self._players if player.id == player_id), None))
