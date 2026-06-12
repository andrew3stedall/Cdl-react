from pathlib import Path

from cdl_api.repositories.postgres_squad_state import SQUAD_STATE_TABLES

MIGRATION_PATH = Path("migrations/versions/0004_squad_transfer_trade_state.py")

EXPECTED_TABLES = {
    "squad_player_rights",
    "squad_roster_slots",
    "draft_picks",
    "squad_interests",
    "free_agent_claims",
    "transfer_proposals",
    "trade_proposals",
    "trade_assets",
    "trade_approvals",
    "squad_audit_events",
}


def test_squad_state_metadata_lists_expected_tables() -> None:
    table_names = {table.name for table in SQUAD_STATE_TABLES}

    assert table_names == EXPECTED_TABLES


def test_squad_state_migration_depends_on_core_league_schema() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")

    assert "Revision ID: 0004_squad_transfer_trade_state" in content
    assert "Revises: 0003_core_league_fpl_cache" in content
    assert 'down_revision: str | None = "0003_core_league_fpl_cache"' in content


def test_squad_state_migration_creates_required_tables() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")

    for table_name in EXPECTED_TABLES:
        assert f'"{table_name}"' in content
