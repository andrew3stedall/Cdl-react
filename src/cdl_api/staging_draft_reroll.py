"""Reroll staging draft positions after the canonical constrained mock draft."""

from dataclasses import dataclass

from sqlalchemy import func, select, text, update
from sqlalchemy.orm import Session

from cdl_api.repositories.postgres_league_fpl import fpl_players_table
from cdl_api.repositories.postgres_squad import squad_ownerships_table, squad_roster_slots_table
from cdl_api.staging_draft_seed import POSITION_LIMITS, SEASON_ID, SQUAD_SIZE, TEAM_IDS, TEAM_NAMES

# Reroll 2 deliberately moves every named manager to a different snake-draft
# position. The underlying constrained draft remains reproducible, but staging
# no longer recreates the same named squads that were already visible before
# the reset. Bump this offset (1..7) for a future staging reroll.
REROLL_OFFSET = 3


@dataclass(frozen=True)
class StagingDraftRerollResult:
    ownerships: int
    cleared_lineup_rows: int
    position_counts: tuple[tuple[int, int, int, int], ...]


def _target_team_id(source_team_id: str) -> str:
    source_index = TEAM_IDS.index(source_team_id)
    return TEAM_IDS[(source_index + REROLL_OFFSET) % len(TEAM_IDS)]


def _slot_id(team_id: str, sort_order: int) -> str:
    return f"slot-{team_id.removeprefix('team-')}-{sort_order:02d}"


def _read_position_counts(session: Session) -> tuple[tuple[int, int, int, int], ...]:
    rows = session.execute(
        select(
            squad_ownerships_table.c.draft_team_id,
            fpl_players_table.c.position_id,
            func.count(),
        )
        .join(
            fpl_players_table,
            squad_ownerships_table.c.player_id == fpl_players_table.c.id,
        )
        .where(
            squad_ownerships_table.c.season_id == SEASON_ID,
            squad_ownerships_table.c.ended_at.is_(None),
        )
        .group_by(
            squad_ownerships_table.c.draft_team_id,
            fpl_players_table.c.position_id,
        )
    ).all()
    by_team = {team_id: {position: 0 for position in POSITION_LIMITS} for team_id in TEAM_IDS}
    for team_id, position, count in rows:
        if team_id in by_team and position in POSITION_LIMITS:
            by_team[str(team_id)][str(position)] = int(count)
    return tuple(
        (
            by_team[team_id]["GKP"],
            by_team[team_id]["DEF"],
            by_team[team_id]["MID"],
            by_team[team_id]["FWD"],
        )
        for team_id in TEAM_IDS
    )


def _validate_position_counts(position_counts: tuple[tuple[int, int, int, int], ...]) -> None:
    for team_index, counts_tuple in enumerate(position_counts):
        counts = dict(zip(("GKP", "DEF", "MID", "FWD"), counts_tuple, strict=True))
        if sum(counts.values()) != SQUAD_SIZE:
            raise ValueError(f"{TEAM_NAMES[team_index]} must have exactly {SQUAD_SIZE} players.")
        for position, (minimum, maximum) in POSITION_LIMITS.items():
            if not minimum <= counts[position] <= maximum:
                raise ValueError(
                    f"{TEAM_NAMES[team_index]} has invalid {position} count {counts[position]} "
                    f"(allowed {minimum}-{maximum})."
                )


def reroll_staging_draft_assignments(session_factory: object) -> StagingDraftRerollResult:
    """Move each valid drafted squad to a different named team atomically.

    This models a fresh staging mock-draft order without weakening the canonical
    ranking or positional constraints. Existing saved lineup rows are cleared so
    a pre-reset gameweek selection cannot leak into the newly assigned squad.
    """
    with session_factory() as session:
        ownership_rows = list(
            session.execute(
                select(
                    squad_ownerships_table.c.id,
                    squad_ownerships_table.c.draft_team_id,
                    squad_roster_slots_table.c.sort_order,
                )
                .join(
                    squad_roster_slots_table,
                    squad_ownerships_table.c.roster_slot_id == squad_roster_slots_table.c.id,
                )
                .where(
                    squad_ownerships_table.c.season_id == SEASON_ID,
                    squad_ownerships_table.c.ended_at.is_(None),
                )
                .order_by(squad_ownerships_table.c.id)
            ).mappings()
        )
        expected_ownerships = len(TEAM_IDS) * SQUAD_SIZE
        if len(ownership_rows) != expected_ownerships:
            raise ValueError(
                f"Expected {expected_ownerships} active staging ownerships before reroll; "
                f"found {len(ownership_rows)}."
            )

        for row in ownership_rows:
            source_team_id = str(row["draft_team_id"])
            target_team_id = _target_team_id(source_team_id)
            sort_order = int(row["sort_order"])
            session.execute(
                update(squad_ownerships_table)
                .where(squad_ownerships_table.c.id == row["id"])
                .values(
                    draft_team_id=target_team_id,
                    roster_slot_id=_slot_id(target_team_id, sort_order),
                )
            )

        cleared_lineups = session.execute(
            text("DELETE FROM team_selection_lineup_slots WHERE season_id = :season_id"),
            {"season_id": SEASON_ID},
        )
        if session.get_bind().dialect.name == "postgresql":
            session.execute(
                text("DELETE FROM lineup_substitutions WHERE season_id = :season_id"),
                {"season_id": SEASON_ID},
            )
        position_counts = _read_position_counts(session)
        _validate_position_counts(position_counts)
        session.commit()

    return StagingDraftRerollResult(
        ownerships=expected_ownerships,
        cleared_lineup_rows=max(0, int(cleared_lineups.rowcount or 0)),
        position_counts=position_counts,
    )
