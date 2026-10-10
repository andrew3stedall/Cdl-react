from pathlib import Path

import pytest

from cdl_api.staging_candidate_smoke import (
    CandidateSmokeError,
    fixture_is_locked,
    lineup_write_payload,
)


def _snapshot(
    *, player_count: int = 20, chip_count: int = 5, locked: bool = False
) -> dict[str, object]:
    return {
        "manager_team": {"id": "team-smoke", "name": "Smoke FC"},
        "fixture_lock": {"locked": locked, "reason": "FPL deadline passed." if locked else None},
        "lineup": [
            {
                "id": f"player-{index}",
                "slot": "starter" if index < 11 else "bench",
                "slot_order": index + 1,
                "is_captain": index == 0,
                "is_vice_captain": index == 1,
            }
            for index in range(player_count)
        ],
        "chips": [
            {"id": f"chip-{index}", "name": f"Chip {index}", "status": "available"}
            for index in range(chip_count)
        ],
    }


def test_lineup_write_payload_preserves_current_contract_without_state_change() -> None:
    payload = lineup_write_payload(_snapshot())

    assert len(payload["players"]) == 20
    assert payload["players"][0] == {
        "player_id": "player-0",
        "slot": "starter",
        "slot_order": 1,
        "is_captain": True,
        "is_vice_captain": False,
    }
    assert payload["players"][1]["is_vice_captain"] is True


@pytest.mark.parametrize(
    ("player_count", "chip_count", "message"),
    [
        (19, 5, "20-player"),
        (20, 4, "five-chip"),
    ],
)
def test_lineup_write_payload_fails_closed_for_stale_release_contracts(
    player_count: int, chip_count: int, message: str
) -> None:
    with pytest.raises(CandidateSmokeError, match=message):
        lineup_write_payload(_snapshot(player_count=player_count, chip_count=chip_count))


def test_fixture_lock_controls_candidate_smoke_mutation() -> None:
    assert fixture_is_locked(_snapshot(locked=True))
    assert not fixture_is_locked(_snapshot())


def test_candidate_smoke_module_never_needs_committed_credentials() -> None:
    source = Path("src/cdl_api/staging_candidate_smoke.py").read_text(encoding="utf-8")

    assert "candidate-reviewer-emails" not in source
    assert "candidate-login-secret" not in source
    assert "manager@example" not in source
