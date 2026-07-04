"""PostgreSQL table metadata for fixtures, scoring, standings, and knockouts."""

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, MetaData, String, Table, text

metadata = MetaData()

cdl_fixtures_table = Table(
    "cdl_fixtures",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("home_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("away_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("status", String(64), nullable=False),
    Column("round_label", String(64), nullable=False),
    Column("kickoff_label", String(64), nullable=False),
    Column("is_current", Boolean(), nullable=False),
    Column("is_next", Boolean(), nullable=False),
    Column("detail_available", Boolean(), nullable=False),
)

epl_fixtures_table = Table(
    "epl_fixtures",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("home_team_id", String(64), ForeignKey("epl_teams.id"), nullable=False),
    Column("away_team_id", String(64), ForeignKey("epl_teams.id"), nullable=False),
    Column("kickoff_at", DateTime(timezone=True), nullable=True),
    Column("status", String(64), nullable=False),
)

fixture_results_table = Table(
    "fixture_results",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("fixture_id", String(64), ForeignKey("cdl_fixtures.id"), nullable=False),
    Column("home_score", Integer(), nullable=True),
    Column("away_score", Integer(), nullable=True),
    Column("outcome", String(64), nullable=False),
    Column("completed_at", DateTime(timezone=True), nullable=True),
)

fixture_scoring_snapshots_table = Table(
    "fixture_scoring_snapshots",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("fixture_id", String(64), ForeignKey("cdl_fixtures.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("points", Integer(), nullable=False),
    Column("bonus_points", Integer(), nullable=False),
    Column("chips_played_json", JSON(), nullable=False, server_default=text("'[]'")),
    Column("calculated_at", DateTime(timezone=True), nullable=False),
)

league_table_snapshots_table = Table(
    "league_table_snapshots",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("position", Integer(), nullable=False),
    Column("played", Integer(), nullable=False),
    Column("wins", Integer(), nullable=False),
    Column("draws", Integer(), nullable=False),
    Column("losses", Integer(), nullable=False),
    Column("points_for", Integer(), nullable=False),
    Column("points_against", Integer(), nullable=False),
    Column("league_points", Integer(), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

knockout_matches_table = Table(
    "knockout_matches",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("fixture_id", String(64), ForeignKey("cdl_fixtures.id"), nullable=False),
    Column("round_label", String(64), nullable=False),
    Column("sort_order", Integer(), nullable=False),
    Column("winner_team_id", String(64), ForeignKey("draft_teams.id"), nullable=True),
)

head_to_head_records_table = Table(
    "head_to_head_records",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("opponent_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("played", Integer(), nullable=False),
    Column("wins", Integer(), nullable=False),
    Column("draws", Integer(), nullable=False),
    Column("losses", Integer(), nullable=False),
    Column("points_for", Integer(), nullable=False),
    Column("points_against", Integer(), nullable=False),
    Column("notes", String(512), nullable=False),
)

LEAGUE_FIXTURE_PERSISTENCE_TABLES = (
    cdl_fixtures_table,
    epl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
    league_table_snapshots_table,
    knockout_matches_table,
    head_to_head_records_table,
)
