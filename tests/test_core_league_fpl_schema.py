from pathlib import Path

from cdl_api.repositories.postgres_league_fpl import CORE_LEAGUE_TABLES

MIGRATION_PATH = Path("migrations/versions/0003_core_league_fpl_cache.py")

EXPECTED_TABLES = {
    "leagues",
    "seasons",
    "managers",
    "draft_teams",
    "league_memberships",
    "league_permissions",
    "fpl_positions",
    "epl_teams",
    "fpl_players",
    "fpl_player_values",
    "fpl_player_availability",
    "fpl_cache_freshness",
}


def test_core_league_fpl_metadata_lists_expected_tables() -> None:
    table_names = {table.name for table in CORE_LEAGUE_TABLES}

    assert table_names == EXPECTED_TABLES


def test_core_league_fpl_migration_depends_on_auth_preferences() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")

    assert "Revision ID: 0003_core_league_fpl_cache" in content
    assert "Revises: 0002_auth_preferences" in content
    assert 'down_revision: str | None = "0002_auth_preferences"' in content


def test_core_league_fpl_migration_creates_required_tables() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")

    for table_name in EXPECTED_TABLES:
        assert f'"{table_name}"' in content
