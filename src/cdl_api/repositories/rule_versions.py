"""Read the immutable rule version selected for a season."""

from collections.abc import Mapping
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    insert,
    select,
    update,
)
from sqlalchemy.orm import Session

metadata = MetaData()

INITIAL_RULE_CONFIG: dict[str, object] = {
    "schema_version": 1,
    "squad": {
        "size": 20,
        "position_limits": {
            "GKP": {"min": 2, "max": 3},
            "DEF": {"min": 4, "max": 10},
            "MID": {"min": 5, "max": 10},
            "FWD": {"min": 2, "max": 4},
        },
    },
    "lineup": {
        "starters": 11,
        "starter_position_limits": {
            "GKP": {"min": 1, "max": 1},
            "DEF": {"min": 3, "max": 5},
            "MID": {"min": 2, "max": 5},
            "FWD": {"min": 1, "max": 3},
        },
        "captain_and_vice_must_start": True,
        "normal_substitution_minutes": 0,
        "substitutions_preserve_formation": True,
        "reserves_score": False,
    },
    "transfers": {"cooling_off_gameweeks": 4},
    "scoring": {
        "league_points": {"win": 3, "draw": 1, "loss": 0},
        "chips": {
            "triple_captain_multiplier": 3,
            "dual_captain_multiplier": 2,
            "auto_captain_multiplier": 2,
            "bench_boost_includes_bench": True,
            "best_xi_count": 11,
            "best_xi_ignores_position": True,
        },
        "bonus_policy": "unconfigured_pending_494",
        "captain_absence_policy": "unconfigured_pending_499",
        "playoff_tie_policy": "unconfigured_pending_496",
    },
}

CURRENT_RULE_CONFIG: dict[str, object] = {
    **INITIAL_RULE_CONFIG,
    "schema_version": 2,
    "scoring": {
        **INITIAL_RULE_CONFIG["scoring"],
        "bonus_policy": {
            "type": "score_multiple",
            "double_threshold": 2,
            "double_bonus": 1,
            "triple_threshold": 3,
            "triple_bonus": 2,
            "max_bonus": 2,
            "opponent_score_must_be_positive": True,
            "applies_to": "regular_season_league_table",
            "live_projection": True,
        },
    },
}

league_season_rule_versions_table = Table(
    "league_season_rule_versions",
    metadata,
    Column("id", String(96), primary_key=True),
    Column("season_id", String(64), nullable=False),
    Column("version", Integer, nullable=False),
    Column("config_json", JSON, nullable=False),
    Column("source_decision_version", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
league_season_rule_state_table = Table(
    "league_season_rule_state",
    metadata,
    Column("season_id", String(64), primary_key=True),
    Column("active_version_id", String(96), ForeignKey("league_season_rule_versions.id")),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)


def active_rule_version_id(session: Session, season_id: str) -> str | None:
    """Resolve the version pinned when a lineup or official result is frozen."""
    value = session.execute(
        select(league_season_rule_state_table.c.active_version_id).where(
            league_season_rule_state_table.c.season_id == season_id
        )
    ).scalar_one_or_none()
    return str(value) if value is not None else None


def immutable_rule_config(session: Session, version_id: str) -> Mapping[str, object] | None:
    """Return a stored version config without exposing mutation operations."""
    value = session.execute(
        select(league_season_rule_versions_table.c.config_json).where(
            league_season_rule_versions_table.c.id == version_id
        )
    ).scalar_one_or_none()
    return value if isinstance(value, Mapping) else None


def ensure_initial_rule_version(session: Session, season_id: str) -> str:
    """Create current accepted defaults once, without changing an active version."""
    version_id = f"rules-{season_id}-v1"
    existing = session.execute(
        select(league_season_rule_versions_table.c.id).where(
            league_season_rule_versions_table.c.id == version_id
        )
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if existing is None:
        session.execute(
            insert(league_season_rule_versions_table).values(
                id=version_id,
                season_id=season_id,
                version=1,
                config_json=INITIAL_RULE_CONFIG,
                source_decision_version="decision-log-2026-06-02",
                created_at=now,
            )
        )
    active = session.execute(
        select(league_season_rule_state_table.c.active_version_id).where(
            league_season_rule_state_table.c.season_id == season_id
        )
    ).scalar_one_or_none()
    if active is None:
        session.execute(
            insert(league_season_rule_state_table).values(
                season_id=season_id,
                active_version_id=version_id,
                updated_at=now,
            )
        )
    return version_id



def ensure_current_rule_version(session: Session, season_id: str) -> str:
    """Ensure the accepted current rule snapshot exists and is active."""
    ensure_initial_rule_version(session, season_id)
    active_id = active_rule_version_id(session, season_id)
    active_version = None
    if active_id is not None:
        active_version = session.execute(
            select(league_season_rule_versions_table.c.version).where(
                league_season_rule_versions_table.c.id == active_id
            )
        ).scalar_one_or_none()
    if isinstance(active_version, int) and active_version >= 2:
        return active_id

    version_id = f"rules-{season_id}-v2"
    existing = session.execute(
        select(league_season_rule_versions_table.c.id).where(
            league_season_rule_versions_table.c.id == version_id
        )
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if existing is None:
        session.execute(
            insert(league_season_rule_versions_table).values(
                id=version_id,
                season_id=season_id,
                version=2,
                config_json=CURRENT_RULE_CONFIG,
                source_decision_version="issue-494-2026-10-08",
                created_at=now,
            )
        )
    session.execute(
        update(league_season_rule_state_table)
        .where(league_season_rule_state_table.c.season_id == season_id)
        .values(active_version_id=version_id, updated_at=now)
    )
    return version_id


def league_bonus_points(
    team_score: int,
    opponent_score: int,
    config: Mapping[str, object] | None,
) -> int:
    """Return the configured CDL league-table bonus for one team."""
    if opponent_score <= 0:
        return 0
    scoring = config.get("scoring") if isinstance(config, Mapping) else None
    policy = scoring.get("bonus_policy") if isinstance(scoring, Mapping) else None
    if not isinstance(policy, Mapping) or policy.get("type") != "score_multiple":
        return 0

    triple_threshold = int(policy.get("triple_threshold", 3))
    triple_bonus = int(policy.get("triple_bonus", 2))
    double_threshold = int(policy.get("double_threshold", 2))
    double_bonus = int(policy.get("double_bonus", 1))
    max_bonus = int(policy.get("max_bonus", 2))
    if team_score >= triple_threshold * opponent_score:
        return min(triple_bonus, max_bonus)
    if team_score >= double_threshold * opponent_score:
        return min(double_bonus, max_bonus)
    return 0
