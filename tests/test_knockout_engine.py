import pytest

from cdl_api.services.knockout_engine import (
    KnockoutLegResult,
    resolve_tie,
    seed_bottom_two,
    seed_top_four,
)


def test_documented_top_four_and_bottom_two_seed_order() -> None:
    standings = ["first", "second", "third", "fourth", "fifth", "sixth"]

    assert seed_top_four(standings) == [("first", "fourth"), ("second", "third")]
    assert seed_bottom_two(standings) == ("fifth", "sixth")


def test_knockout_tie_uses_aggregate_then_scoring_lineup_goals() -> None:
    legs = [
        KnockoutLegResult("a", "b", 1, 2, 1, 0),
        KnockoutLegResult("b", "a", 1, 0, 0, 1),
    ]

    resolution = resolve_tie(("a", "b"), legs)

    assert resolution.aggregate == {"a": 1, "b": 3}
    assert resolution.winner_team_id == "b"
    assert resolution.status == "decided_by_aggregate"


def test_equal_aggregate_and_goals_stays_unresolved_without_invented_winner() -> None:
    legs = [
        KnockoutLegResult("a", "b", 1, 1, 1, 0),
        KnockoutLegResult("b", "a", 1, 1, 1, 0),
    ]

    resolution = resolve_tie(("a", "b"), legs)

    assert resolution.winner_team_id is None
    assert resolution.status == "unresolved_aggregate_and_goals_tie"


def test_equal_aggregate_uses_scoring_lineup_goals() -> None:
    legs = [
        KnockoutLegResult("a", "b", 2, 1, 1, 0),
        KnockoutLegResult("b", "a", 2, 1, 0, 2),
    ]

    resolution = resolve_tie(("a", "b"), legs)

    assert resolution.aggregate == {"a": 3, "b": 3}
    assert resolution.winner_team_id == "a"
    assert resolution.status == "decided_by_goals"


def test_tie_rejects_leg_with_other_teams() -> None:
    with pytest.raises(ValueError, match="same two teams"):
        resolve_tie(("a", "b"), [KnockoutLegResult("a", "c", 1, 0, 1, 0)])
