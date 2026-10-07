from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import MetaData, create_engine, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.contracts.session import SessionUser
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
from cdl_api.repositories.postgres_squad import (
    squad_ownerships_table,
    squad_roster_slots_table,
)
from cdl_api.repositories.postgres_team_selection import team_selection_lineup_slots_table
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.live_draft import get_live_draft_service
from cdl_api.routers.live_draft import router as live_draft_router
from cdl_api.services.live_draft import LiveDraftError, LiveDraftService
from cdl_api.staging_draft_seed import LEAGUE_ID, SEASON_ID


def _service() -> tuple[LiveDraftService, sessionmaker[Session], Engine]:
    metadata = MetaData()
    for table in (
        users_table,
        leagues_table,
        seasons_table,
        managers_table,
        draft_teams_table,
        league_memberships_table,
        fpl_positions_table,
        epl_teams_table,
        fpl_players_table,
        fpl_player_values_table,
        squad_roster_slots_table,
        squad_ownerships_table,
        team_selection_lineup_slots_table,
        live_draft_events_table,
        live_draft_queue_table,
        live_drafts_table,
        live_draft_picks_table,
    ):
        table.to_metadata(metadata)
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory.begin() as session:
        session.execute(
            insert(users_table).values(
                id="user-a",
                email="a@example.test",
                display_name="A",
                roles=["manager", "commissioner"],
            )
        )
        session.execute(
            insert(users_table).values(
                id="user-b", email="b@example.test", display_name="B", roles=["manager"]
            )
        )
        session.execute(insert(leagues_table).values(id=LEAGUE_ID, name="Test", code="test"))
        session.execute(
            insert(seasons_table).values(
                id=SEASON_ID, league_id=LEAGUE_ID, name="2026", start_gameweek=1, end_gameweek=38
            )
        )
        for team_id in ("team-a", "team-b"):
            manager_id = team_id.replace("team", "manager")
            session.execute(
                insert(managers_table).values(
                    id=manager_id,
                    user_id="user-a" if team_id == "team-a" else "user-b",
                    display_name=manager_id,
                )
            )
            session.execute(
                insert(draft_teams_table).values(
                    id=team_id, league_id=LEAGUE_ID, manager_id=manager_id, name=team_id
                )
            )
            session.execute(
                insert(league_memberships_table).values(
                    id=f"membership-{team_id}",
                    league_id=LEAGUE_ID,
                    manager_id=manager_id,
                    role="commissioner" if team_id == "team-a" else "manager",
                )
            )
            for slot_no in range(1, 21):
                session.execute(
                    insert(squad_roster_slots_table).values(
                        id=f"slot-{team_id}-{slot_no}",
                        season_id=SEASON_ID,
                        draft_team_id=team_id,
                        slot_key=f"slot-{slot_no}",
                        position_id=None,
                        sort_order=slot_no,
                        is_required=True,
                    )
                )
        session.execute(
            insert(fpl_positions_table).values(
                id="MID", singular_name="Midfielder", plural_name="Midfielders"
            )
        )
        session.execute(
            insert(epl_teams_table).values(id="epl-test", short_name="TST", name="Test Club")
        )
        positions = ["MID"] * 16 + ["DEF"] * 12 + ["FWD"] * 8 + ["GKP"] * 4
        for number, position in enumerate(positions, start=1):
            player_id = f"fpl-{number}"
            session.execute(
                insert(fpl_players_table).values(
                    id=player_id,
                    first_name="Test",
                    second_name=str(number),
                    web_name=f"Player {number}",
                    position_id=position,
                    team_id="epl-test",
                )
            )
            session.execute(
                insert(fpl_player_values_table).values(
                    id=f"value-{number}",
                    player_id=player_id,
                    gameweek=1,
                    value=120 - number,
                )
            )
        for position in ("GKP", "DEF", "FWD"):
            session.execute(
                insert(fpl_positions_table).values(
                    id=position, singular_name=position, plural_name=f"{position}s"
                )
            )
    return LiveDraftService(factory), factory, engine


def test_persisted_snake_picks_are_idempotent_and_assign_squad_ownership() -> None:
    service, factory, engine = _service()
    draft_id = service.create(
        actor_id="user-a",
        mode="snake",
        rounds=20,
        clock_enabled=False,
        pick_seconds=None,
        manual_team_order=None,
    )
    service.control("user-a", "start")
    room = service.room("user-a", "team-a")
    assert room["id"] == draft_id
    assert room["current_team_id"] == "team-a"

    result = service.make_pick(
        actor_id="user-a",
        team_id="team-a",
        player_id="fpl-1",
        idempotency_key="pick-1",
    )
    repeated = service.make_pick(
        actor_id="user-a",
        team_id="team-a",
        player_id="fpl-3",
        idempotency_key="pick-1",
    )
    assert result["id"] == repeated["id"]
    assert service.room("user-a", "team-b")["current_team_id"] == "team-b"
    service.make_pick(
        actor_id="user-a",
        team_id="team-b",
        player_id="fpl-2",
        idempotency_key="pick-2",
    )
    assert service.room("user-a", "team-a")["current_team_id"] == "team-b"
    service.make_pick(
        actor_id="user-a",
        team_id="team-b",
        player_id="fpl-3",
        idempotency_key="pick-3",
    )
    assert service.room("user-a", "team-a")["current_team_id"] == "team-a"
    service.make_pick(
        actor_id="user-a",
        team_id="team-a",
        player_id="fpl-4",
        idempotency_key="pick-4",
    )
    room = service.room("user-a", "team-a")
    assert room["status"] == "active"
    assert [pick["team_id"] for pick in room["picks"]] == ["team-a", "team-b", "team-b", "team-a"]
    with factory() as session:
        assert session.execute(select(squad_ownerships_table.c.player_id)).scalars().all() == [
            "fpl-1",
            "fpl-2",
            "fpl-3",
            "fpl-4",
        ]
    service.correct_pick(
        actor_id="user-a", pick_number=1, player_id="fpl-5", reason="Draft board entry was wrong."
    )
    corrected = service.room("user-a", "team-a", "commissioner")
    assert corrected["picks"][0]["player_id"] == "fpl-5"
    assert corrected["picks"][0]["source"] == "commissioner_correction"
    with factory() as session:
        owned = session.execute(
            select(squad_ownerships_table.c.player_id, squad_ownerships_table.c.ended_at)
        ).all()
        assert any(player_id == "fpl-1" and ended_at is not None for player_id, ended_at in owned)
        assert any(player_id == "fpl-5" and ended_at is None for player_id, ended_at in owned)
    engine.dispose()


def test_queue_autopick_uses_queue_and_duplicate_players_are_rejected() -> None:
    service, _, engine = _service()
    service.create(
        actor_id="user-a",
        mode="random_repeat",
        rounds=20,
        clock_enabled=False,
        pick_seconds=None,
        manual_team_order=None,
    )
    service.control("user-a", "start")
    first_team = service.room("user-a", "team-a")["current_team_id"]
    service.set_queue("user-a", first_team, ["fpl-4", "fpl-2"])
    auto = service.make_pick(
        actor_id="user-a",
        team_id=first_team,
        player_id=None,
        idempotency_key="auto-1",
        source="auto",
    )
    assert auto["player_id"] == "fpl-4"
    next_team = service.room("user-a", "team-a")["current_team_id"]
    service.make_pick(
        actor_id="user-a",
        team_id=next_team,
        player_id="fpl-1",
        idempotency_key="pick-next",
    )
    next_team = service.room("user-a", "team-a")["current_team_id"]
    with pytest.raises(LiveDraftError, match="already been drafted"):
        service.make_pick(
            actor_id="user-a",
            team_id=next_team,
            player_id="fpl-4",
            idempotency_key="duplicate",
        )
    engine.dispose()


def test_clock_timeout_does_not_allow_early_autopick() -> None:
    service, factory, engine = _service()
    service.create(
        actor_id="user-a",
        mode="manual",
        rounds=20,
        clock_enabled=True,
        pick_seconds=10,
        manual_team_order=["team-a", "team-b"],
    )
    service.control("user-a", "start")
    with pytest.raises(LiveDraftError, match="clock has not expired"):
        service.make_pick(
            actor_id="user-a",
            team_id="team-a",
            player_id=None,
            idempotency_key="early",
            source="auto",
        )
    with factory.begin() as session:
        deadline = datetime.now(UTC) - timedelta(seconds=1)
        session.execute(live_drafts_table.update().values(clock_deadline_at=deadline))
    room = service.room("user-a", "team-a", "commissioner")
    assert room["picks"][0]["player_id"] == "fpl-1"
    assert room["picks"][0]["source"] == "system_timeout_auto"
    with factory() as session:
        event = session.execute(select(live_drafts_table.c.status)).scalar_one()
        assert event == "active"
    engine.dispose()


def test_league_manager_cannot_start_room_or_pick_out_of_turn() -> None:
    service, _, engine = _service()
    service.create(
        actor_id="user-a",
        mode="manual",
        rounds=20,
        clock_enabled=False,
        pick_seconds=None,
        manual_team_order=["team-a", "team-b"],
    )
    service.control("user-a", "start")
    app = FastAPI()
    app.include_router(live_draft_router)
    app.dependency_overrides[require_authenticated_session] = lambda: SessionUser(
        id="user-b", email="b@example.test", display_name="B", roles=["manager"]
    )
    app.dependency_overrides[get_live_draft_service] = lambda: service
    client = TestClient(app)
    response = client.post(
        "/live-draft",
        json={"mode": "snake", "rounds": 20, "clock_enabled": False},
    )
    assert response.status_code == 403
    response = client.post(
        "/live-draft/pick",
        json={"player_id": "fpl-1", "idempotency_key": "wrong-turn"},
    )
    assert response.status_code == 409
    engine.dispose()


def test_draft_availability_reports_active_squad_ownership_block() -> None:
    service, factory, engine = _service()
    app = FastAPI()
    app.include_router(live_draft_router)
    app.dependency_overrides[require_authenticated_session] = lambda: SessionUser(
        id="user-a", email="a@example.test", display_name="A", roles=["commissioner"]
    )
    app.dependency_overrides[get_live_draft_service] = lambda: service
    client = TestClient(app)

    available = client.get("/live-draft/availability")
    assert available.status_code == 200
    assert available.json() == {"blocked_by_active_ownerships": False}

    with factory.begin() as session:
        session.execute(
            insert(squad_ownerships_table).values(
                id="owned-player",
                season_id=SEASON_ID,
                draft_team_id="team-a",
                player_id="fpl-1",
                roster_slot_id="slot-team-a-1",
                started_at=datetime.now(UTC),
                ended_at=None,
            )
        )

    blocked = client.get("/live-draft/availability")
    assert blocked.status_code == 200
    assert blocked.json() == {"blocked_by_active_ownerships": True}
    with pytest.raises(LiveDraftError, match="already has active squad ownerships"):
        service.create(
            actor_id="user-a",
            mode="snake",
            rounds=20,
            clock_enabled=False,
            pick_seconds=None,
            manual_team_order=None,
        )
    engine.dispose()


def test_incomplete_draft_cannot_be_marked_complete() -> None:
    service, factory, engine = _service()
    service.create(
        actor_id="user-a",
        mode="manual",
        rounds=20,
        clock_enabled=False,
        pick_seconds=None,
        manual_team_order=["team-a", "team-b"],
    )
    service.control("user-a", "start")
    service.make_pick(
        actor_id="user-a",
        team_id="team-a",
        player_id="fpl-1",
        idempotency_key="partial-draft-pick",
    )
    with pytest.raises(LiveDraftError, match="Every scheduled pick"):
        service.control("user-a", "complete")
    with factory() as session:
        draft = session.execute(
            select(live_drafts_table.c.status, live_drafts_table.c.pick_index)
        ).one()
    assert draft == ("active", 1)
    engine.dispose()


def test_commissioner_correction_is_blocked_after_lineup_lock() -> None:
    service, factory, engine = _service()
    service.create(
        actor_id="user-a",
        mode="manual",
        rounds=20,
        clock_enabled=False,
        pick_seconds=None,
        manual_team_order=["team-a", "team-b"],
    )
    service.control("user-a", "start")
    service.make_pick(
        actor_id="user-a",
        team_id="team-a",
        player_id="fpl-1",
        idempotency_key="locked-draft-pick",
    )
    locked_at = datetime.now(UTC)
    with factory.begin() as session:
        session.execute(
            insert(team_selection_lineup_slots_table).values(
                id="locked-lineup-row",
                season_id=SEASON_ID,
                draft_team_id="team-a",
                player_id="fpl-1",
                gameweek=1,
                slot="starter",
                slot_order=1,
                is_captain=True,
                is_vice_captain=False,
                locked_at=locked_at,
                updated_at=locked_at,
            )
        )
    with pytest.raises(LiveDraftError, match="after a season lineup locks"):
        service.correct_pick(
            actor_id="user-a",
            pick_number=1,
            player_id="fpl-5",
            reason="Correction was requested after kickoff.",
        )
    room = service.room("user-a", "team-a", "commissioner")
    assert room["picks"][0]["player_id"] == "fpl-1"
    engine.dispose()


def test_commissioner_correction_is_blocked_after_draft_completion() -> None:
    service, factory, engine = _service()
    service.create(
        actor_id="user-a",
        mode="manual",
        rounds=20,
        clock_enabled=False,
        pick_seconds=None,
        manual_team_order=["team-a", "team-b"],
    )
    service.control("user-a", "start")
    service.make_pick(
        actor_id="user-a",
        team_id="team-a",
        player_id="fpl-1",
        idempotency_key="completed-draft-pick",
    )
    with factory.begin() as session:
        session.execute(live_drafts_table.update().values(status="complete"))
    with pytest.raises(LiveDraftError, match="before the draft completes"):
        service.correct_pick(
            actor_id="user-a",
            pick_number=1,
            player_id="fpl-5",
            reason="Correction was requested after draft completion.",
        )
    with factory() as session:
        assert session.execute(
            select(squad_ownerships_table.c.player_id).where(
                squad_ownerships_table.c.ended_at.is_(None)
            )
        ).scalars().all() == ["fpl-1"]
    engine.dispose()
