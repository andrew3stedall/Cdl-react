"""Deterministic automatic substitution rules for completed gameweeks."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class LineupPlayer:
    """A locked lineup player needed by the substitution rules."""

    player_id: str
    position: str
    slot: str
    slot_order: int


@dataclass(frozen=True)
class AppliedSubstitution:
    """An automatic substitution selected for the scoring lineup."""

    starter_player_id: str
    substitute_player_id: str
    starter_slot_order: int
    bench_order: int
    reason: str = "starter_did_not_play"
    formation_preserved: bool = True


def apply_automatic_substitutions(
    lineup: Sequence[LineupPlayer],
    minutes_by_player: Mapping[str, int],
) -> tuple[list[LineupPlayer], list[AppliedSubstitution]]:
    """Replace non-playing starters with the first valid playing bench players.

    This function is intentionally called only after the CDL fixture/gameweek
    has finished. Missing minutes are not treated as zero by this function;
    callers must pass a player only when the completed FPL payload explicitly
    reports their minutes.
    """

    starters = sorted(
        (player for player in lineup if player.slot == "starter"),
        key=lambda player: player.slot_order,
    )
    bench = sorted(
        (player for player in lineup if player.slot == "bench"),
        key=lambda player: player.slot_order,
    )
    active_starters = list(starters)
    available_bench = list(bench)
    substitutions: list[AppliedSubstitution] = []

    for starter in starters:
        if _minutes_for(starter.player_id, minutes_by_player) != 0:
            continue

        for candidate in available_bench:
            candidate_minutes = _minutes_for(candidate.player_id, minutes_by_player)
            if candidate_minutes is None or candidate_minutes <= 0:
                continue
            if not _positions_compatible(starter.position, candidate.position):
                continue

            replacement_index = next(
                index
                for index, active_player in enumerate(active_starters)
                if active_player.player_id == starter.player_id
            )
            proposed_starters = [*active_starters]
            proposed_starters[replacement_index] = candidate
            if not is_valid_starting_formation(proposed_starters):
                continue

            active_starters = proposed_starters
            available_bench.remove(candidate)
            substitutions.append(
                AppliedSubstitution(
                    starter_player_id=starter.player_id,
                    substitute_player_id=candidate.player_id,
                    starter_slot_order=starter.slot_order,
                    bench_order=candidate.slot_order,
                )
            )
            break

    return active_starters, substitutions


def is_valid_starting_formation(players: Sequence[LineupPlayer]) -> bool:
    """Return whether players satisfy the CDL Starting XI formation rules."""

    if len(players) != 11:
        return False

    counts = {position: 0 for position in ("GKP", "DEF", "MID", "FWD")}
    for player in players:
        position = _normalise_position(player.position)
        if position not in counts:
            return False
        counts[position] += 1

    return (
        counts["GKP"] == 1
        and 3 <= counts["DEF"] <= 5
        and 2 <= counts["MID"] <= 5
        and 1 <= counts["FWD"] <= 3
    )


def _minutes_for(player_id: str, minutes_by_player: Mapping[str, int]) -> int | None:
    value = minutes_by_player.get(player_id.removeprefix("fpl-"))
    if value is None:
        value = minutes_by_player.get(player_id)
    return int(value) if value is not None else None


def _positions_compatible(starter_position: str, candidate_position: str) -> bool:
    starter = _normalise_position(starter_position)
    candidate = _normalise_position(candidate_position)
    return (starter == "GKP") == (candidate == "GKP")


def _normalise_position(position: str) -> str:
    normalized = position.strip().upper()
    return {
        "GK": "GKP",
        "GOALKEEPER": "GKP",
        "DEFENDER": "DEF",
        "MIDFIELDER": "MID",
        "FORWARD": "FWD",
        "STRIKER": "FWD",
    }.get(normalized, normalized)
