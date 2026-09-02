from cdl_api.services.substitution_engine import (
    AppliedSubstitution,
    LineupPlayer,
    apply_automatic_substitutions,
)


def _lineup() -> list[LineupPlayer]:
    return [
        LineupPlayer("fpl-1", "GKP", "starter", 1),
        LineupPlayer("fpl-2", "DEF", "starter", 2),
        LineupPlayer("fpl-3", "DEF", "starter", 3),
        LineupPlayer("fpl-4", "DEF", "starter", 4),
        LineupPlayer("fpl-5", "DEF", "starter", 5),
        LineupPlayer("fpl-6", "MID", "starter", 6),
        LineupPlayer("fpl-7", "MID", "starter", 7),
        LineupPlayer("fpl-8", "MID", "starter", 8),
        LineupPlayer("fpl-9", "MID", "starter", 9),
        LineupPlayer("fpl-10", "FWD", "starter", 10),
        LineupPlayer("fpl-11", "FWD", "starter", 11),
        LineupPlayer("fpl-12", "GKP", "bench", 0),
        LineupPlayer("fpl-13", "DEF", "bench", 1),
        LineupPlayer("fpl-14", "MID", "bench", 2),
        LineupPlayer("fpl-15", "FWD", "bench", 3),
        LineupPlayer("fpl-16", "DEF", "bench", 4),
    ]


def test_replaces_non_playing_starter_in_bench_order_and_preserves_formation() -> None:
    starters, substitutions = apply_automatic_substitutions(
        _lineup(),
        {
            **{str(player_id): 90 for player_id in range(1, 12)},
            "2": 0,
            "10": 0,
            "12": 90,
            "13": 90,
            "14": 0,
            "15": 90,
            "16": 90,
        },
    )

    assert [player.player_id for player in starters] == [
        "fpl-1",
        "fpl-13",
        "fpl-3",
        "fpl-4",
        "fpl-5",
        "fpl-6",
        "fpl-7",
        "fpl-8",
        "fpl-9",
        "fpl-15",
        "fpl-11",
    ]
    assert substitutions == [
        AppliedSubstitution(
            starter_player_id="fpl-2",
            substitute_player_id="fpl-13",
            starter_slot_order=2,
            bench_order=1,
        ),
        AppliedSubstitution(
            starter_player_id="fpl-10",
            substitute_player_id="fpl-15",
            starter_slot_order=10,
            bench_order=3,
        ),
    ]


def test_does_not_substitute_a_starter_who_played_or_a_zero_minute_bench_player() -> None:
    starters, substitutions = apply_automatic_substitutions(
        _lineup(),
        {"2": 0, "13": 0, "16": 0},
    )

    assert [player.player_id for player in starters] == [
        player.player_id for player in _lineup() if player.slot == "starter"
    ]
    assert substitutions == []
