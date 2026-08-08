from collections import Counter

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.staging_draft_seed import SEASON_ID, TEAM_IDS
from cdl_api.staging_team_selection_seed import (
    STARTER_LIMITS,
    RosterPlayer,
    build_legal_lineup,
    seed_staging_team_selections,
)

SQUAD_COMPOSITIONS = (
    (2, 5, 10, 3),
    (2, 6, 10, 2),
    (2, 5, 9, 4),
    (2, 6, 10, 2),
    (2, 7, 7, 4),
    (2, 5, 9, 4),
    (2, 6, 8, 4),
    (2, 4, 10, 4),
)


def _roster(composition: tuple[int, int, int, int]) -> list[RosterPlayer]:
    players: list[RosterPlayer] = []
    order = 1
    for position, count in zip(("GKP", "DEF", "MID", "FWD"), composition, strict=True):
        for index in range(count):
            players.append(
                RosterPlayer(
                    player_id=f"{position.lower()}-{index + 1}",
                    position=position,
                    sort_order=order,
                )
            )
            order += 1
    return players


def test_every_staging_squad_shape_can_produce_legal_weekly_selection() -> None:
    for composition in SQUAD_COMPOSITIONS:
        assignments = build_legal_lineup(_roster(composition))
        starters = [assignment for assignment in assignments if assignment.slot == "starter"]
        bench = [assignment for assignment in assignments if assignment.slot == "bench"]
        reserves = [assignment for assignment in assignments if assignment.slot == "reserve"]

        assert (len(starters), len(bench), len(reserves)) == (11, 5, 4)
        starter_counts = Counter(assignment.position for assignment in starters)
        for position, (minimum, maximum) in STARTER_LIMITS.items():
            assert minimum <= starter_counts[position] <= maximum
        assert sum(assignment.position == "GKP" for assignment in bench) == 1
        assert sorted(
            assignment.slot_order for assignment in bench if assignment.position != "GKP"
        ) == [1, 2, 3, 4]
        assert next(
            assignment.slot_order for assignment in bench if assignment.position == "GKP"
        ) == 0
        assert sum(assignment.is_captain for assignment in starters) == 1
        assert sum(assignment.is_vice_captain for assignment in starters) == 1


def test_seed_persists_complete_legal_lineups_for_all_eight_teams() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE fpl_players (id TEXT PRIMARY KEY, position_id TEXT NOT NULL)")
        )
        connection.execute(
            text(
                "CREATE TABLE squad_roster_slots ("
                "id TEXT PRIMARY KEY, season_id TEXT NOT NULL, draft_team_id TEXT NOT NULL, "
                "sort_order INTEGER NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE squad_ownerships ("
                "id TEXT PRIMARY KEY, season_id TEXT NOT NULL, draft_team_id TEXT NOT NULL, "
                "player_id TEXT NOT NULL, roster_slot_id TEXT NOT NULL, ended_at DATETIME)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE team_selection_lineup_slots ("
                "id TEXT PRIMARY KEY, season_id TEXT NOT NULL, draft_team_id TEXT NOT NULL, "
                "player_id TEXT NOT NULL, gameweek INTEGER NOT NULL, slot TEXT NOT NULL, "
                "slot_order INTEGER NOT NULL, is_captain BOOLEAN NOT NULL, "
                "is_vice_captain BOOLEAN NOT NULL, locked_at DATETIME, updated_at DATETIME NOT NULL)"
            )
        )

        for team_index, (team_id, composition) in enumerate(
            zip(TEAM_IDS, SQUAD_COMPOSITIONS, strict=True)
        ):
            roster = _roster(composition)
            for player in roster:
                player_id = f"team-{team_index}-{player.player_id}"
                slot_id = f"slot-{team_index}-{player.sort_order}"
                connection.execute(
                    text("INSERT INTO fpl_players (id, position_id) VALUES (:id, :position)"),
                    {"id": player_id, "position": player.position},
                )
                connection.execute(
                    text(
                        "INSERT INTO squad_roster_slots "
                        "(id, season_id, draft_team_id, sort_order) "
                        "VALUES (:id, :season, :team, :sort_order)"
                    ),
                    {
                        "id": slot_id,
                        "season": SEASON_ID,
                        "team": team_id,
                        "sort_order": player.sort_order,
                    },
                )
                connection.execute(
                    text(
                        "INSERT INTO squad_ownerships "
                        "(id, season_id, draft_team_id, player_id, roster_slot_id, ended_at) "
                        "VALUES (:id, :season, :team, :player, :slot, NULL)"
                    ),
                    {
                        "id": f"ownership-{team_index}-{player.sort_order}",
                        "season": SEASON_ID,
                        "team": team_id,
                        "player": player_id,
                        "slot": slot_id,
                    },
                )

    session_factory = sessionmaker(bind=engine, class_=Session)
    result = seed_staging_team_selections(session_factory)

    assert result.teams == 8
    assert result.rows == 160
    assert len(result.formations) == 8

    with engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT draft_team_id, player_id, slot, slot_order, is_captain, is_vice_captain "
                "FROM team_selection_lineup_slots ORDER BY draft_team_id, slot, slot_order"
            )
        ).mappings()
        by_team: dict[str, list[dict[str, object]]] = {team_id: [] for team_id in TEAM_IDS}
        for row in rows:
            by_team[str(row["draft_team_id"])].append(dict(row))

    for team_id in TEAM_IDS:
        assignments = by_team[team_id]
        assert len(assignments) == 20
        assert sum(row["slot"] == "starter" for row in assignments) == 11
        assert sum(row["slot"] == "bench" for row in assignments) == 5
        assert sum(row["slot"] == "reserve" for row in assignments) == 4
        assert sum(bool(row["is_captain"]) for row in assignments) == 1
        assert sum(bool(row["is_vice_captain"]) for row in assignments) == 1
