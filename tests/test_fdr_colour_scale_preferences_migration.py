from pathlib import Path

MIGRATION_PATH = Path("migrations/versions/0012_fdr_colour_scale_preferences.py")


def test_fdr_colour_scale_preferences_migration_is_append_only() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")

    assert "Revision ID: 0012_fdr_colour_scale_preferences" in content
    assert "Revises: 0011_pitch_attack_direction" in content
    assert '"fdr_scale"' in content
    assert '"fdr_scale_reversed"' in content
    assert 'server_default="RdYlGn"' in content
    assert "server_default=sa.true()" in content
