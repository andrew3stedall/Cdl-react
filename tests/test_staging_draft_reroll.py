from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_squad import squad_ownerships_table
from cdl_api.staging_draft_reroll import REROLL_OFFSET, reroll_staging_draft_assignments
from cdl_api.staging_draft_seed import SEASON_ID, TEAM_IDS


def test_reroll_moves_complete_legal_squads_and_clears_saved_lineups() -> None:
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
                "player_id TEXT NOT NULL, roster_slot_id TEXT, ended_at DATETIME)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE team_selection_lineup_slots ("
                "id TEXT PRIMARY KEY, season_id TEXT NOT NULL)"
            )
        )

        positions = ["GKP"] * 2 + ["DEF"] * 5 + ["MID"] * 9 + ["FWD"] * 4
        for team_index, team_id in enumerate(TEAM_IDS):
            for slot_number, position in enumerate(positions, 1):
                player_id = f"p-{team_index}-{slot_number:02d}"
                slot_id = f"slot-{team_id.removeprefix('team-')}-{slot_number:02d}"
                connection.execute(
                    text("INSERT INTO fpl_players (id, position_id) VALUES (:id, :position)"),
                    {"id": player_id, "position": position},
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
                        "sort_order": slot_number,
                    },
                )
                connection.execute(
                    text(
                        "INSERT INTO squad_ownerships "
                        "(id, season_id, draft_team_id, player_id, roster_slot_id, ended_at) "
                        "VALUES (:id, :season, :team, :player, :slot, NULL)"
                    ),
                    {
                        "id": f"ownership-{team_index}-{slot_number:02d}",
                        "season": SEASON_ID,
                        "team": team_id,
                        "player": player_id,
                        "slot": slot_id,
                    },
                )
            connection.execute(
                text(
                    "INSERT INTO team_selection_lineup_slots (id, season_id) VALUES (:id, :season)"
                ),
                {"id": f"lineup-{team_index}", "season": SEASON_ID},
            )

    session_factory = sessionmaker(bind=engine, class_=Session)
    result = reroll_staging_draft_assignments(session_factory)

    assert result.ownerships == 160
    assert result.cleared_lineup_rows == 8
    assert result.position_counts == ((2, 5, 9, 4),) * 8

    source_for_primary = (-REROLL_OFFSET) % len(TEAM_IDS)
    with session_factory() as session:
        primary_player_ids = list(
            session.execute(
                select(squad_ownerships_table.c.player_id)
                .where(squad_ownerships_table.c.draft_team_id == TEAM_IDS[0])
                .order_by(squad_ownerships_table.c.player_id)
            ).scalars()
        )
        remaining_lineups = session.execute(
            text("SELECT COUNT(*) FROM team_selection_lineup_slots")
        ).scalar_one()

    assert len(primary_player_ids) == 20
    assert all(player_id.startswith(f"p-{source_for_primary}-") for player_id in primary_player_ids)
    assert remaining_lineups == 0
