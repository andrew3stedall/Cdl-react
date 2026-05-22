"""In-memory team selection repository for feature development."""

from copy import deepcopy

from cdl_api.contracts.common import RuleReference
from cdl_api.contracts.domain import FixtureSummary, GameweekSummary, TeamSummary
from cdl_api.contracts.team_selection import (
    ChipState,
    ChipStatus,
    LineupPlayerUpdate,
    LineupSlot,
    TeamSelectionPlayer,
)


class InMemoryTeamSelectionRepository:
    def __init__(self) -> None:
        self.manager_team = TeamSummary(id="team-castle", name="Castle FC", short_name="CFC")
        rival = TeamSummary(id="team-rival", name="Rival Town", short_name="RTN")
        arsenal = TeamSummary(id="epl-ars", name="Arsenal", short_name="ARS")
        city = TeamSummary(id="epl-mci", name="Manchester City", short_name="MCI")
        self.gameweek = GameweekSummary(id="gw-1", name="Gameweek 1", number=1)
        self._players = [
            TeamSelectionPlayer(id="player-1", display_name="Alex Keeper", position="GKP", team=arsenal, epl_team=arsenal, slot=LineupSlot.STARTER, slot_order=1),
            TeamSelectionPlayer(id="player-2", display_name="Ben Defender", position="DEF", team=city, epl_team=city, slot=LineupSlot.STARTER, slot_order=2),
            TeamSelectionPlayer(id="player-3", display_name="Casey Midfielder", position="MID", team=arsenal, epl_team=arsenal, slot=LineupSlot.STARTER, slot_order=3, is_captain=True),
            TeamSelectionPlayer(id="player-4", display_name="Riley Forward", position="FWD", team=city, epl_team=city, slot=LineupSlot.BENCH, slot_order=1, is_vice_captain=True),
            TeamSelectionPlayer(id="player-5", display_name="Morgan Reserve", position="MID", team=arsenal, epl_team=arsenal, slot=LineupSlot.RESERVE, slot_order=1),
        ]
        self._chips = [
            ChipState(id="wildcard", name="Wildcard", status=ChipStatus.AVAILABLE, rule_reference=RuleReference(rule_id="chip-usage", label="Chip Usage", href="/rules#chip-usage")),
            ChipState(id="bench-boost", name="Bench Boost", status=ChipStatus.USED, rule_reference=RuleReference(rule_id="chip-usage", label="Chip Usage", href="/rules#chip-usage")),
            ChipState(id="triple-captain", name="Triple Captain", status=ChipStatus.AVAILABLE, rule_reference=RuleReference(rule_id="captaincy", label="Captaincy", href="/rules#captaincy")),
        ]
        self._cdl_fixtures = [FixtureSummary(id="fixture-1", gameweek=self.gameweek, home_team=self.manager_team, away_team=rival, status="scheduled")]
        self._epl_fixtures = [FixtureSummary(id="epl-fixture-1", gameweek=self.gameweek, home_team=arsenal, away_team=city, status="scheduled")]
        self._cdl_table = [self.manager_team, rival]
        self._epl_table = [arsenal, city]

    def get_players(self) -> list[TeamSelectionPlayer]:
        return deepcopy(self._players)

    def get_chips(self) -> list[ChipState]:
        return deepcopy(self._chips)

    def save_lineup(self, updates: list[LineupPlayerUpdate]) -> list[TeamSelectionPlayer]:
        updates_by_id = {update.player_id: update for update in updates}
        for player in self._players:
            update = updates_by_id.get(player.id)
            if update is None:
                continue
            player.slot = update.slot
            player.slot_order = update.slot_order
            player.is_captain = update.is_captain
            player.is_vice_captain = update.is_vice_captain
        return self.get_players()

    def save_chips(self, chips: list[ChipState]) -> list[ChipState]:
        self._chips = deepcopy(chips)
        return self.get_chips()

    def fixture_summary(self) -> tuple[list[FixtureSummary], list[FixtureSummary], list[TeamSummary], list[TeamSummary]]:
        return (
            deepcopy(self._cdl_fixtures),
            deepcopy(self._epl_fixtures),
            deepcopy(self._cdl_table),
            deepcopy(self._epl_table),
        )
