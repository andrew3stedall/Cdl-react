"""PostgreSQL-only live-draft persistence smoke test with isolated fixtures."""

import os
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, delete, insert, select
from sqlalchemy.orm import sessionmaker

from cdl_api.repositories.live_draft import (
    live_draft_events_table,
    live_draft_picks_table,
    live_draft_queue_table,
    live_drafts_table,
)
from cdl_api.repositories.postgres_auth import users_table
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    epl_teams_table,
    fpl_player_values_table,
    fpl_players_table,
    fpl_positions_table,
    league_memberships_table,
    leagues_table,
    managers_table,
    seasons_table,
)
from cdl_api.repositories.postgres_squad import squad_ownerships_table, squad_roster_slots_table
from cdl_api.services.live_draft import LiveDraftService
from cdl_api.staging_draft_seed import POSITION_LIMITS

POSTGRES_URL = os.getenv("CDL_DATABASE_URL", "")


@pytest.mark.skipif(not POSTGRES_URL.startswith("postgresql"), reason="PostgreSQL CI only")
def test_postgres_live_draft_persists_serial_pick_and_squad_assignment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import cdl_api.services.live_draft as live_draft_module

    suffix = uuid4().hex[:12]
    league_id = f"draft-test-league-{suffix}"
    season_id = f"draft-test-season-{suffix}"
    user_id = f"draft-test-user-{suffix}"
    manager_ids = [f"draft-test-manager-{suffix}-{index}" for index in range(2)]
    team_ids = [f"draft-test-team-{suffix}-{index}" for index in range(2)]
    epl_id = f"draft-test-epl-{suffix}"
    player_ids = [f"draft-test-player-{suffix}-{index:02d}" for index in range(40)]
    inserted_positions: list[str] = []
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(live_draft_module, "LEAGUE_ID", league_id)
    monkeypatch.setattr(live_draft_module, "SEASON_ID", season_id)

    try:
        with factory.begin() as session:
            session.execute(
                insert(users_table).values(
                    id=user_id, email=f"{user_id}@example.test", display_name="Draft test", roles=[]
                )
            )
            session.execute(
                insert(leagues_table).values(id=league_id, name="Draft test", code=suffix)
            )
            session.execute(
                insert(seasons_table).values(
                    id=season_id,
                    league_id=league_id,
                    name="Draft test season",
                    start_gameweek=1,
                    end_gameweek=38,
                )
            )
            session.execute(
                insert(epl_teams_table).values(
                    id=epl_id, short_name=suffix[:3], name="Draft test club"
                )
            )
            for position in POSITION_LIMITS:
                if (
                    session.execute(
                        select(fpl_positions_table.c.id).where(fpl_positions_table.c.id == position)
                    ).scalar_one_or_none()
                    is None
                ):
                    session.execute(
                        insert(fpl_positions_table).values(
                            id=position, singular_name=position, plural_name=f"{position}s"
                        )
                    )
                    inserted_positions.append(position)
            for index, team_id in enumerate(team_ids):
                manager_id = manager_ids[index]
                session.execute(
                    insert(managers_table).values(
                        id=manager_id, user_id=user_id, display_name=f"Manager {index}"
                    )
                )
                session.execute(
                    insert(draft_teams_table).values(
                        id=team_id, league_id=league_id, manager_id=manager_id, name=f"Team {index}"
                    )
                )
                session.execute(
                    insert(league_memberships_table).values(
                        id=f"draft-test-membership-{suffix}-{index}",
                        league_id=league_id,
                        manager_id=manager_id,
                        role="commissioner" if index == 0 else "manager",
                    )
                )
                for slot_number in range(1, 21):
                    session.execute(
                        insert(squad_roster_slots_table).values(
                            id=f"draft-test-slot-{suffix}-{index}-{slot_number}",
                            season_id=season_id,
                            draft_team_id=team_id,
                            slot_key=f"slot-{slot_number}",
                            position_id=None,
                            sort_order=slot_number,
                            is_required=True,
                        )
                    )
            positions = ["GKP"] * 4 + ["DEF"] * 10 + ["MID"] * 18 + ["FWD"] * 8
            for index, position in enumerate(positions):
                player_id = player_ids[index]
                session.execute(
                    insert(fpl_players_table).values(
                        id=player_id,
                        first_name="Draft",
                        second_name=str(index),
                        web_name=f"Draft {index}",
                        position_id=position,
                        team_id=epl_id,
                    )
                )
                session.execute(
                    insert(fpl_player_values_table).values(
                        id=f"draft-test-value-{suffix}-{index}",
                        player_id=player_id,
                        gameweek=1,
                        value=120 - index,
                    )
                )

        service = LiveDraftService(factory)
        service.create(
            actor_id=user_id,
            mode="snake",
            rounds=20,
            clock_enabled=False,
            pick_seconds=None,
            manual_team_order=None,
        )
        service.control(user_id, "start")
        first_team = service.room(user_id, team_ids[0], "commissioner")["current_team_id"]
        first_player = player_ids[14]
        service.make_pick(
            actor_id=user_id,
            team_id=first_team,
            player_id=first_player,
            idempotency_key="postgres-pick-1",
        )
        room = service.room(user_id, team_ids[0], "commissioner")
        assert len(room["picks"]) == 1
        assert room["picks"][0]["player_id"] == first_player
        with factory() as session:
            assignment = session.execute(
                select(squad_ownerships_table.c.player_id).where(
                    squad_ownerships_table.c.season_id == season_id,
                    squad_ownerships_table.c.ended_at.is_(None),
                )
            ).scalar_one()
            assert assignment == first_player
    finally:
        with factory.begin() as session:
            draft_ids = select(live_drafts_table.c.id).where(
                live_drafts_table.c.league_id == league_id
            )
            for table in (
                live_draft_events_table,
                live_draft_picks_table,
                live_draft_queue_table,
            ):
                session.execute(delete(table).where(table.c.draft_id.in_(draft_ids)))
            session.execute(
                delete(live_drafts_table).where(live_drafts_table.c.league_id == league_id)
            )
            session.execute(
                delete(fpl_player_values_table).where(
                    fpl_player_values_table.c.player_id.in_(player_ids)
                )
            )
            session.execute(
                delete(squad_ownerships_table).where(
                    squad_ownerships_table.c.season_id == season_id
                )
            )
            session.execute(
                delete(squad_roster_slots_table).where(
                    squad_roster_slots_table.c.season_id == season_id
                )
            )
            session.execute(delete(fpl_players_table).where(fpl_players_table.c.id.in_(player_ids)))
            if inserted_positions:
                session.execute(
                    delete(fpl_positions_table).where(
                        fpl_positions_table.c.id.in_(inserted_positions)
                    )
                )
            session.execute(delete(epl_teams_table).where(epl_teams_table.c.id == epl_id))
            session.execute(
                delete(league_memberships_table).where(
                    league_memberships_table.c.league_id == league_id
                )
            )
            session.execute(
                delete(draft_teams_table).where(draft_teams_table.c.league_id == league_id)
            )
            session.execute(delete(managers_table).where(managers_table.c.id.in_(manager_ids)))
            session.execute(delete(seasons_table).where(seasons_table.c.id == season_id))
            session.execute(delete(leagues_table).where(leagues_table.c.id == league_id))
            session.execute(delete(users_table).where(users_table.c.id == user_id))
        engine.dispose()
