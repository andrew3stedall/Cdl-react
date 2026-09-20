from cdl_api.repositories.postgres_squad_repository import (
    _merge_live_form_history,
    _merge_summary_form_history,
)


def test_summary_history_preserves_double_gameweek_fixture_rows() -> None:
    history = {"fpl-7": {}}

    _merge_summary_form_history(
        history,
        "fpl-7",
        {
            "history": [
                {"round": 10, "fixture": 101, "total_points": 0, "minutes": 0},
                {"round": 10, "fixture": 102, "total_points": 8, "minutes": 90},
            ]
        },
    )

    assert list(history["fpl-7"][10]) == ["101", "102"]
    assert history["fpl-7"][10]["101"].minutes == 0
    assert history["fpl-7"][10]["102"].total_points == 8


def test_live_history_uses_explain_rows_for_double_gameweeks() -> None:
    history = {"fpl-7": {}}

    _merge_live_form_history(
        history,
        {"fpl-7"},
        11,
        {
            "elements": [
                {
                    "id": 7,
                    "explain": [
                        {
                            "fixture": 201,
                            "stats": [
                                {"identifier": "minutes", "value": 90, "points": 2},
                                {"identifier": "goals_scored", "value": 1, "points": 5},
                            ],
                        },
                        {
                            "fixture": 202,
                            "stats": [
                                {"identifier": "minutes", "value": 0, "points": 0},
                            ],
                        },
                    ],
                }
            ]
        },
    )

    assert history["fpl-7"][11]["201"].total_points == 7
    assert history["fpl-7"][11]["201"].minutes == 90
    assert history["fpl-7"][11]["202"].minutes == 0
