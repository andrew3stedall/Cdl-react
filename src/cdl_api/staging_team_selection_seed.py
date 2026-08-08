"""Seed legal gameweek-one selections for every staging draft team."""

from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from cdl_api.repositories.postgres_league_fpl import fpl_players_table
from cdl_api.repositories.postgres_squad import squad_ownerships_table, squad_roster_slots_table
from cdl_api.staging_draft_seed import SEASON_ID, SQUAD_SIZE, TEAM_IDS

GAMEWEEK = 1
STARTER_MINIMUMS = {"GKP": 1, "DEF": 3, "MID": 2, "FWD": 1}
STARTER_MAXIMUMS = {"GKP": 1, "DEF": 5, "MID": 5, "FWD": 3}
POSITION_ORDER = ("GKP", "DEF", "MID", "FWD")


@dataclass(frozen=True)
class RosterPlayer:
    player_id: str
    position: str
    sort_order: int


@dataclass(frozen=True)
class LineupAssignment:
    player_id: str
    position: str
    slot: str
    slot_order: int
    is_captain: bool = False
    is_vice_captain: bool = False


@dataclass(frozen=True)
class StagingLineupSeedResult:
    teams: int
    rows: int
    formations: tuple[str, ...]


def build_legal_lineup(roster: list[RosterPlayer]) -> tuple[LineupAssignment, ...]:
    """Partition a 20-player roster into legal starters, bench and reserves.

    Selection honours the existing roster/draft sort order as far as possible,
    while forcing the Starting XI into a legal 3-5 DEF / 2-5 MID / 1-3 FWD
    formation. The bench contains exactly one goalkeeper plus four ordered
    outfield substitutes. All remaining players are reserves.
    """
    if len(roster) != SQUAD_SIZE:
        raise ValueError(f"Expected {SQUAD_SIZE} roster players; found {len(roster)}.")
    ordered = sorted(roster, key=lambda player: player.sort_order)
    if len({player.player_id for player in ordered}) != SQUAD_SIZE:
        raise ValueError("A staging roster cannot contain duplicate players.")

    by_position = {
        position: [player for player in ordered if player.position == position]
        for position in POSITION_ORDER
    }
    for position, minimum in STARTER_MINIMUMS.items():
        bench_allowance = 1 if position == "GKP" else 0
        if len(by_position[position]) < minimum + bench_allowance:
            raise ValueError(
                f"Roster does not contain enough {position} players for a legal lineup."
            )

    starters: list[RosterPlayer] = []
    selected_ids: set[str] = set()
    starter_counts: Counter[str] = Counter()

    for position in POSITION_ORDER:
        for player in by_position[position][: STARTER_MINIMUMS[position]]:
            starters.append(player)
            selected_ids.add(player.player_id)
            starter_counts[position] += 1

    for player in ordered:
        if len(starters) == 11:
            break
        if player.player_id in selected_ids:
            continue
        if starter_counts[player.position] >= STARTER_MAXIMUMS[player.position]:
            continue
        starters.append(player)
        selected_ids.add(player.player_id)
        starter_counts[player.position] += 1

    if len(starters) != 11:
        raise ValueError(
            "Could not construct an 11-player legal Starting XI from the staging roster."
        )

    remaining = [player for player in ordered if player.player_id not in selected_ids]
    bench_goalkeeper = next(
        (player for player in remaining if player.position == "GKP"),
        None,
    )
    if bench_goalkeeper is None:
        raise ValueError("A legal bench requires one goalkeeper.")
    bench_outfield = [player for player in remaining if player.position != "GKP"][:4]
    if len(bench_outfield) != 4:
        raise ValueError("A legal bench requires four outfield substitutes.")

    bench_ids = {
        bench_goalkeeper.player_id,
        *(player.player_id for player in bench_outfield),
    }
    reserves = [player for player in remaining if player.player_id not in bench_ids]
    if len(reserves) != 4:
        raise ValueError(
            f"A 20-player squad must leave exactly four reserves; found {len(reserves)}."
        )

    ranked_starters = sorted(starters, key=lambda player: player.sort_order)
    captain_candidates = [player for player in ranked_starters if player.position != "GKP"]
    if len(captain_candidates) < 2:
        captain_candidates = ranked_starters
    captain_id = captain_candidates[0].player_id
    vice_captain_id = captain_candidates[1].player_id

    assignments: list[LineupAssignment] = []
    for order, player in enumerate(ranked_starters, 1):
        assignments.append(
            LineupAssignment(
                player_id=player.player_id,
                position=player.position,
                slot="starter",
                slot_order=order,
                is_captain=player.player_id == captain_id,
                is_vice_captain=player.player_id == vice_captain_id,
            )
        )
    assignments.append(
        LineupAssignment(
            player_id=bench_goalkeeper.player_id,
            position=bench_goalkeeper.position,
            slot="bench",
            slot_order=0,
        )
    )
    for order, player in enumerate(bench_outfield, 1):
        assignments.append(
            LineupAssignment(
                player_id=player.player_id,
                position=player.position,
                slot="bench",
                slot_order=order,
            )
        )
    for order, player in enumerate(reserves, 1):
        assignments.append(
            LineupAssignment(
                player_id=player.player_id,
                position=player.position,
                slot="reserve",
                slot_order=order,
            )
        )

    validate_legal_lineup(tuple(assignments))
    return tuple(assignments)


def validate_legal_lineup(assignments: tuple[LineupAssignment, ...]) -> None:
    if len(assignments) != SQUAD_SIZE:
        raise ValueError(f"Lineup must account for all {SQUAD_SIZE} squad players.")
    starters = [assignment for assignment in assignments if assignment.slot == "starter"]
    bench = [assignment for assignment in assignments if assignment.slot == "bench"]
    reserves = [assignment for assignment in assignments if assignment.slot == "reserve"]
    if (len(starters), len(bench), len(reserves)) != (11, 5, 4):
        raise ValueError("Lineup must contain 11 starters, 5 substitutes and 4 reserves.")

    starter_counts = Counter(assignment.position for assignment in starters)
    for position in POSITION_ORDER:
        if not (
            STARTER_MINIMUMS[position]
            <= starter_counts[position]
            <= STARTER_MAXIMUMS[position]
        ):
            raise ValueError(
                f"Illegal Starting XI {position} count {starter_counts[position]} "
                f"(allowed {STARTER_MINIMUMS[position]}-{STARTER_MAXIMUMS[position]})."
            )

    bench_goalkeepers = [assignment for assignment in bench if assignment.position == "GKP"]
    bench_outfield = [assignment for assignment in bench if assignment.position != "GKP"]
    if len(bench_goalkeepers) != 1 or bench_goalkeepers[0].slot_order != 0:
        raise ValueError(
            "Bench must contain exactly one goalkeeper with goalkeeper bench order 0."
        )
    outfield_order = sorted(player.slot_order for player in bench_outfield)
    if len(bench_outfield) != 4 or outfield_order != [1, 2, 3, 4]:
        raise ValueError("Bench must contain four outfield substitutes ordered 1 through 4.")
    if sum(assignment.is_captain for assignment in starters) != 1:
        raise ValueError("Starting XI must contain exactly one captain.")
    if sum(assignment.is_vice_captain for assignment in starters) != 1:
        raise ValueError("Starting XI must contain exactly one vice-captain.")


def formation_for(assignments: tuple[LineupAssignment, ...]) -> str:
    starters = [assignment for assignment in assignments if assignment.slot == "starter"]
    counts = Counter(assignment.position for assignment in starters)
    return f"{counts['DEF']}-{counts['MID']}-{counts['FWD']}"


def _read_roster(session: Session, team_id: str) -> list[RosterPlayer]:
    rows = session.execute(
        select(
            squad_ownerships_table.c.player_id,
            fpl_players_table.c.position_id,
            squad_roster_slots_table.c.sort_order,
        )
        .join(
            fpl_players_table,
            squad_ownerships_table.c.player_id == fpl_players_table.c.id,
        )
        .join(
            squad_roster_slots_table,
            squad_ownerships_table.c.roster_slot_id == squad_roster_slots_table.c.id,
        )
        .where(
            squad_ownerships_table.c.season_id == SEASON_ID,
            squad_ownerships_table.c.draft_team_id == team_id,
            squad_ownerships_table.c.ended_at.is_(None),
        )
        .order_by(squad_roster_slots_table.c.sort_order)
    ).mappings()
    return [
        RosterPlayer(
            player_id=str(row["player_id"]),
            position=str(row["position_id"]),
            sort_order=int(row["sort_order"]),
        )
        for row in rows
    ]


def seed_staging_team_selections(session_factory: object) -> StagingLineupSeedResult:
    """Persist a legal gameweek-one team selection for every staging team."""
    now = datetime(2026, 8, 8, tzinfo=UTC)
    formations: list[str] = []
    row_count = 0

    with session_factory() as session:
        session.execute(
            text(
                "DELETE FROM team_selection_lineup_slots "
                "WHERE season_id = :season_id AND gameweek = :gameweek"
            ),
            {"season_id": SEASON_ID, "gameweek": GAMEWEEK},
        )

        for team_index, team_id in enumerate(TEAM_IDS):
            assignments = build_legal_lineup(_read_roster(session, team_id))
            formations.append(formation_for(assignments))
            for assignment in assignments:
                session.execute(
                    text(
                        "INSERT INTO team_selection_lineup_slots "
                        "(id, season_id, draft_team_id, player_id, gameweek, slot, slot_order, "
                        "is_captain, is_vice_captain, locked_at, updated_at) "
                        "VALUES (:id, :season_id, :draft_team_id, :player_id, :gameweek, :slot, "
                        ":slot_order, :is_captain, :is_vice_captain, NULL, :updated_at)"
                    ),
                    {
                        "id": f"lineup-{team_index + 1}-{GAMEWEEK}-{assignment.player_id}",
                        "season_id": SEASON_ID,
                        "draft_team_id": team_id,
                        "player_id": assignment.player_id,
                        "gameweek": GAMEWEEK,
                        "slot": assignment.slot,
                        "slot_order": assignment.slot_order,
                        "is_captain": assignment.is_captain,
                        "is_vice_captain": assignment.is_vice_captain,
                        "updated_at": now,
                    },
                )
                row_count += 1

        if row_count != len(TEAM_IDS) * SQUAD_SIZE:
            raise ValueError("Staging lineup seed did not persist all eight complete teams.")
        session.commit()

    return StagingLineupSeedResult(
        teams=len(TEAM_IDS),
        rows=row_count,
        formations=tuple(formations),
    )
