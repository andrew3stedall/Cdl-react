from pathlib import Path

from cdl_api.repositories.postgres_squad import SQUAD_PERSISTENCE_TABLES

MIGRATION_PATH = Path("migrations/versions/0004_squad_transfer_persistence.py")
MOVEMENT_MIGRATION_PATH = Path("migrations/versions/0030_movement_workflows.py")

EXPECTED_TABLES = {
    "squad_roster_slots",
    "squad_ownerships",
    "player_rights",
    "draft_picks",
    "squad_interests",
    "free_agent_claims",
    "transfer_proposals",
    "transfer_assets",
    "trade_proposals",
    "trade_assets",
    "trade_approvals",
    "squad_rejection_reasons",
    "squad_audit_events",
}
MOVEMENT_TABLES = {
    "free_agency_draws",
    "free_agency_draw_order",
    "free_agency_preferences",
    "free_agency_results",
    "free_agency_events",
}

REQUIRED_COLUMNS = {
    "squad_roster_slots": {"season_id", "draft_team_id", "slot_key", "position_id"},
    "squad_ownerships": {"season_id", "draft_team_id", "player_id", "roster_slot_id"},
    "player_rights": {"season_id", "draft_team_id", "player_id", "right_type"},
    "draft_picks": {"season_id", "original_team_id", "owning_team_id", "round_number"},
    "squad_interests": {"season_id", "draft_team_id", "manager_id", "player_id", "note"},
    "free_agent_claims": {"season_id", "draft_team_id", "manager_id", "player_id"},
    "transfer_proposals": {"season_id", "proposing_team_id", "target_team_id", "status"},
    "transfer_assets": {"proposal_id", "player_id", "direction"},
    "trade_proposals": {"season_id", "offered_by_team_id", "offered_to_team_id", "status"},
    "trade_assets": {"trade_id", "player_id", "from_team_id", "to_team_id"},
    "trade_approvals": {"trade_id", "manager_id", "decision", "decided_at"},
    "squad_rejection_reasons": {"subject_type", "subject_id", "code", "message"},
    "squad_audit_events": {"subject_type", "subject_id", "action", "metadata_json"},
    "free_agency_draws": {"season_id", "gameweek", "status", "closes_at"},
    "free_agency_draw_order": {"draw_id", "draft_team_id", "position"},
    "free_agency_preferences": {"draw_id", "draft_team_id", "manager_id", "player_id", "rank"},
    "free_agency_results": {"draw_id", "draft_team_id", "player_id", "reason_code"},
    "free_agency_events": {"draw_id", "actor_manager_id", "action", "metadata_json"},
}


def test_squad_persistence_metadata_lists_expected_tables() -> None:
    table_names = {table.name for table in SQUAD_PERSISTENCE_TABLES}

    assert table_names == EXPECTED_TABLES | MOVEMENT_TABLES


def test_squad_persistence_metadata_exposes_required_columns() -> None:
    tables_by_name = {table.name: table for table in SQUAD_PERSISTENCE_TABLES}

    for table_name, required_columns in REQUIRED_COLUMNS.items():
        column_names = {column.name for column in tables_by_name[table_name].columns}
        assert required_columns <= column_names


def test_squad_transfer_migration_depends_on_core_league_schema() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")

    assert "Revision ID: 0004_squad_transfer_persistence" in content
    assert "Revises: 0003_core_league_fpl_cache" in content
    assert 'down_revision: str | None = "0003_core_league_fpl_cache"' in content


def test_squad_transfer_migration_creates_required_tables() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")

    for table_name in EXPECTED_TABLES:
        assert f'"{table_name}"' in content


def test_movement_migration_adds_ranked_draw_tables_and_trade_approval_fields() -> None:
    content = MOVEMENT_MIGRATION_PATH.read_text(encoding="utf-8")

    assert 'revision: str = "0030_movement_workflows"' in content
    assert 'down_revision: str | None = "0029_targeted_league_invites"' in content
    for table_name in MOVEMENT_TABLES:
        assert f'"{table_name}"' in content
    assert '"approval_status"' in content
    assert '"required_approver_role"' in content
    assert '"approved_by_manager_id"' in content
    assert '"executed_at"' in content
