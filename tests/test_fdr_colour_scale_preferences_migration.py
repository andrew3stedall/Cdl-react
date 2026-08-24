from pathlib import Path

MIGRATION_PATH = Path("migrations/versions/0012_fdr_colour_scale_preferences.py")


def test_fdr_colour_scale_preferences_migration_is_append_only() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")

    assert "Revision ID: 0012_fdr_scale_prefs" in content
    assert "Revises: 0011_pitch_attack_direction" in content
    assert '"fdr_scale"' in content
    assert '"fdr_scale_reversed"' in content
    assert 'server_default="RdYlGn"' in content
    assert "server_default=sa.true()" in content


def test_fdr_display_mode_migration_is_append_only() -> None:
    content = Path("migrations/versions/0013_fdr_display_mode.py").read_text(encoding="utf-8")

    assert "Revision ID: 0013_fdr_display_mode" in content
    assert "Revises: 0012_fdr_scale_prefs" in content
    assert '"fdr_display_mode"' in content
    assert 'server_default="font"' in content


def test_theme_colour_preferences_migration_is_append_only() -> None:
    content = Path(
        "migrations/versions/0015_theme_colour_preferences.py",
    ).read_text(encoding="utf-8")

    assert "Revision ID: 0015_theme_colour_preferences" in content
    assert "Revises: 0014_fpl_provisional_fixture" in content
    assert '"light_theme_colour"' in content
    assert '"dark_theme_colour"' in content
    assert 'server_default="#0F766E"' in content
    assert 'server_default="#2DD4BF"' in content


def test_full_custom_fdr_palette_migration_is_append_only() -> None:
    content = Path(
        "migrations/versions/0018_fdr_custom_full_palette.py",
    ).read_text(encoding="utf-8")

    assert "Revision ID: 0018_fdr_custom_full_palette" in content
    assert "Revises: 0017_auth_passkeys" in content
    assert '"fdr_custom_second"' in content
    assert '"fdr_custom_fourth"' in content
