"""Deterministic knockout seeding and tie-resolution rules."""

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class KnockoutLegResult:
    """A completed leg's team scores and scoring-lineup goals."""

    home_team_id: str
    away_team_id: str
    home_score: int
    away_score: int
    home_goals: int
    away_goals: int


@dataclass(frozen=True)
class TieResolution:
    """Auditable aggregate/goals decision; unresolved ties have no winner."""

    aggregate: Mapping[str, int]
    scoring_lineup_goals: Mapping[str, int]
    winner_team_id: str | None
    status: str


def resolve_tie(team_ids: tuple[str, str], legs: list[KnockoutLegResult]) -> TieResolution:
    """Resolve by aggregate score, then scoring-lineup goals only."""
    first, second = team_ids
    aggregate = {first: 0, second: 0}
    goals = {first: 0, second: 0}
    for leg in legs:
        if {leg.home_team_id, leg.away_team_id} != {first, second}:
            raise ValueError("Every knockout leg must contain the same two teams.")
        aggregate[leg.home_team_id] += leg.home_score
        aggregate[leg.away_team_id] += leg.away_score
        goals[leg.home_team_id] += leg.home_goals
        goals[leg.away_team_id] += leg.away_goals
    if aggregate[first] != aggregate[second]:
        winner = first if aggregate[first] > aggregate[second] else second
        return TieResolution(aggregate, goals, winner, "decided_by_aggregate")
    if goals[first] != goals[second]:
        winner = first if goals[first] > goals[second] else second
        return TieResolution(aggregate, goals, winner, "decided_by_goals")
    return TieResolution(aggregate, goals, None, "unresolved_aggregate_and_goals_tie")


def seed_top_four(team_ids: list[str]) -> list[tuple[str, str]]:
    """Seed semifinals as 1v4 and 2v3 from final official table order."""
    if len(team_ids) < 4:
        raise ValueError("The top-four bracket needs four qualified teams.")
    return [(team_ids[0], team_ids[3]), (team_ids[1], team_ids[2])]


def seed_bottom_two(team_ids: list[str]) -> tuple[str, str]:
    """Seed the last two official table positions into the documented final."""
    if len(team_ids) < 2:
        raise ValueError("The bottom-two bracket needs two teams.")
    return team_ids[-2], team_ids[-1]
