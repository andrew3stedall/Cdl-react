"""PostgreSQL table metadata for core league and FPL cache data."""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, MetaData, String, Table

metadata = MetaData()

leagues_table = Table(
    "leagues",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("name", String(255), nullable=False),
    Column("code", String(64), nullable=False, unique=True),
)

seasons_table = Table(
    "seasons",
    metadata,
    Column("id", String(64), primary_key=True),
    Column(
        "league_id",
        String(64),
        ForeignKey("leagues.id"),
        nullable=False,
    ),
    Column("name", String(64), nullable=False),
    Column("start_gameweek", Integer(), nullable=False),
    Column("end_gameweek", Integer(), nullable=False),
)

managers_table = Table(
    "managers",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("user_id", String(64), ForeignKey("users.id"), nullable=True),
    Column("display_name", String(255), nullable=False),
)

draft_teams_table = Table(
    "draft_teams",
    metadata,
    Column("id", String(64), primary_key=True),
    Column(
        "league_id",
        String(64),
        ForeignKey("leagues.id"),
        nullable=False,
    ),
    Column("manager_id", String(64), ForeignKey("managers.id"), nullable=True),
    Column("name", String(255), nullable=False),
)

league_memberships_table = Table(
    "league_memberships",
    metadata,
    Column("id", String(64), primary_key=True),
    Column(
        "league_id",
        String(64),
        ForeignKey("leagues.id"),
        nullable=False,
    ),
    Column(
        "manager_id",
        String(64),
        ForeignKey("managers.id"),
        nullable=False,
    ),
    Column("role", String(64), nullable=False),
)

league_permissions_table = Table(
    "league_permissions",
    metadata,
    Column("id", String(64), primary_key=True),
    Column(
        "membership_id",
        String(64),
        ForeignKey("league_memberships.id"),
        nullable=False,
    ),
    Column("permission", String(128), nullable=False),
)

fpl_positions_table = Table(
    "fpl_positions",
    metadata,
    Column("id", String(16), primary_key=True),
    Column("singular_name", String(64), nullable=False),
    Column("plural_name", String(64), nullable=False),
)

epl_teams_table = Table(
    "epl_teams",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("short_name", String(16), nullable=False),
    Column("name", String(255), nullable=False),
)

fpl_players_table = Table(
    "fpl_players",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("first_name", String(255), nullable=False),
    Column("second_name", String(255), nullable=False),
    Column("web_name", String(255), nullable=False),
    Column(
        "position_id",
        String(16),
        ForeignKey("fpl_positions.id"),
        nullable=False,
    ),
    Column("team_id", String(64), ForeignKey("epl_teams.id"), nullable=False),
)

fpl_player_values_table = Table(
    "fpl_player_values",
    metadata,
    Column("id", String(64), primary_key=True),
    Column(
        "player_id",
        String(64),
        ForeignKey("fpl_players.id"),
        nullable=False,
    ),
    Column("gameweek", Integer(), nullable=False),
    Column("value", Integer(), nullable=False),
)

fpl_player_availability_table = Table(
    "fpl_player_availability",
    metadata,
    Column("id", String(64), primary_key=True),
    Column(
        "player_id",
        String(64),
        ForeignKey("fpl_players.id"),
        nullable=False,
    ),
    Column("status", String(16), nullable=False),
    Column("news", String(512), nullable=False),
)

fpl_cache_freshness_table = Table(
    "fpl_cache_freshness",
    metadata,
    Column("resource", String(128), primary_key=True),
    Column("last_updated_at", DateTime(timezone=True), nullable=False),
)

CORE_LEAGUE_TABLES = (
    leagues_table,
    seasons_table,
    managers_table,
    draft_teams_table,
    league_memberships_table,
    league_permissions_table,
    fpl_positions_table,
    epl_teams_table,
    fpl_players_table,
    fpl_player_values_table,
    fpl_player_availability_table,
    fpl_cache_freshness_table,
)
