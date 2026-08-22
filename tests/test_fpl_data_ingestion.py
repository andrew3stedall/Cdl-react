from datetime import UTC, datetime

from sqlalchemy import create_engine, func, insert, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.contracts.fpl_data import FplPlayerHistoryResponse, FplRefreshResource
from cdl_api.fpl_client import FplApiResponse
from cdl_api.repositories.postgres_fpl_data import (
    PostgreSQLFplDataRepository,
    external_fetch_log_table,
    external_payload_cache_table,
    fpl_fixtures_table,
    fpl_gameweeks_table,
    fpl_player_current_metrics_table,
)
from cdl_api.repositories.postgres_league_fpl import (
    epl_teams_table,
    fpl_cache_freshness_table,
    fpl_player_availability_table,
    fpl_player_values_table,
    fpl_players_table,
    fpl_positions_table,
)
from cdl_api.repositories.postgres_squad_repository import (
    PostgreSQLSquadRepository,
    _active_gameweek_player_values_subquery,
)
from cdl_api.services.fpl_data_service import FplDataService

BOOTSTRAP = {
    "events": [
        {
            "id": 1,
            "name": "Gameweek 1",
            "deadline_time": "2026-08-14T17:30:00Z",
            "is_previous": False,
            "is_current": True,
            "is_next": False,
            "finished": False,
            "data_checked": False,
        }
    ],
    "element_types": [
        {
            "id": 1,
            "singular_name": "Goalkeeper",
            "plural_name": "Goalkeepers",
            "singular_name_short": "GKP",
        }
    ],
    "teams": [
        {"id": 1, "short_name": "ARS", "name": "Arsenal"},
        {"id": 2, "short_name": "AVL", "name": "Aston Villa"},
    ],
    "elements": [
        {
            "id": 10,
            "first_name": "Test",
            "second_name": "Keeper",
            "web_name": "Keeper",
            "element_type": 1,
            "team": 1,
            "now_cost": 55,
            "status": "d",
            "news": "75% chance of playing",
            "total_points": 42,
            "form": "6.5",
            "selected_by_percent": "12.3",
            "minutes": 720,
            "goals_scored": 0,
            "assists": 1,
            "clean_sheets": 4,
            "expected_goals": "0.10",
            "expected_assists": "0.75",
            "chance_of_playing_next_round": 75,
        }
    ],
}

FIXTURES = [
    {
        "id": 100,
        "event": 1,
        "team_h": 1,
        "team_a": 2,
        "kickoff_time": "2026-08-15T14:00:00Z",
        "started": False,
        "finished": False,
        "team_h_difficulty": 2,
        "team_a_difficulty": 4,
        "team_h_score": None,
        "team_a_score": None,
    }
]

ELEMENT_SUMMARY = {
    "history": [
        {
            "round": 1,
            "fixture": 100,
            "opponent_team": 2,
            "total_points": 8,
            "minutes": 90,
            "goals_scored": 0,
            "assists": 1,
            "clean_sheets": 1,
            "bonus": 2,
            "bps": 28,
            "expected_goals": "0.05",
            "expected_assists": "0.42",
            "value": 55,
            "was_home": True,
            "kickoff_time": "2026-08-15T14:00:00Z",
        }
    ],
    "fixtures": [
        {
            "id": 101,
            "event": 2,
            "opponent_team": None,
            "difficulty": 3,
            "is_home": False,
            "kickoff_time": "2026-08-22T14:00:00Z",
        }
    ],
    "history_past": [],
}

EVENT_LIVE = {
    "elements": [
        {
            "id": 901,
            "explain": [
                {
                    "fixture": 98,
                    "stats": [
                        {"identifier": "minutes", "points": 2, "value": 90},
                        {"identifier": "goals_scored", "points": 5, "value": 1},
                    ],
                }
            ],
        },
        {
            "id": 902,
            "explain": [
                {
                    "fixture": 98,
                    "stats": [
                        {"identifier": "minutes", "points": 2, "value": 90},
                        {"identifier": "assists", "points": 3, "value": 1},
                    ],
                }
            ],
        },
        {
            "id": 903,
            "explain": [
                {
                    "fixture": 98,
                    "stats": [
                        {"identifier": "minutes", "points": 2, "value": 90},
                        {"identifier": "clean_sheets", "points": 1, "value": 1},
                    ],
                }
            ],
        },
    ]
}


class FakeClient:
    def __init__(self) -> None:
        self.element_summary_calls = 0
        self.event_live_calls = 0

    def endpoint_for(self, path: str) -> str:
        return f"https://fantasy.premierleague.com/api/{path}"

    def fetch_bootstrap_static(self) -> FplApiResponse:
        return FplApiResponse(
            endpoint=self.endpoint_for("bootstrap-static/"),
            payload=BOOTSTRAP,
            status_code=200,
        )

    def fetch_fixtures(self) -> FplApiResponse:
        return FplApiResponse(
            endpoint=self.endpoint_for("fixtures/"),
            payload=FIXTURES,
            status_code=200,
        )

    def fetch_element_summary(self, player_id: int) -> FplApiResponse:
        self.element_summary_calls += 1
        return FplApiResponse(
            endpoint=self.endpoint_for(f"element-summary/{player_id}/"),
            payload=ELEMENT_SUMMARY,
            status_code=200,
        )

    def fetch_event_live(self, gameweek: int) -> FplApiResponse:
        self.event_live_calls += 1
        return FplApiResponse(
            endpoint=self.endpoint_for(f"event/{gameweek}/live/"),
            payload=EVENT_LIVE,
            status_code=200,
        )


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in (
        fpl_positions_table,
        epl_teams_table,
        fpl_players_table,
        fpl_player_values_table,
        fpl_player_availability_table,
        fpl_cache_freshness_table,
        fpl_gameweeks_table,
        fpl_fixtures_table,
        fpl_player_current_metrics_table,
        external_payload_cache_table,
        external_fetch_log_table,
    ):
        table.create(engine)
    return sessionmaker(bind=engine, class_=Session)


def test_refresh_persists_official_bootstrap_and_fixtures_idempotently() -> None:
    sessions = _session_factory()
    repository = PostgreSQLFplDataRepository(sessions)
    service = FplDataService(FakeClient(), repository)

    first = service.refresh(list(FplRefreshResource))
    second = service.refresh(list(FplRefreshResource))

    assert [result.resource for result in first.resources] == list(FplRefreshResource)
    assert len(first.resources[0].response_sha256) == 64
    assert second.resources[0].records_upserted["players"] == 1
    assert second.resources[0].records_upserted["player_metrics"] == 1

    with sessions() as session:
        player_count = session.execute(
            select(func.count()).select_from(fpl_players_table)
        ).scalar_one()
        team_count = session.execute(select(func.count()).select_from(epl_teams_table)).scalar_one()
        gameweek_count = session.execute(
            select(func.count()).select_from(fpl_gameweeks_table)
        ).scalar_one()
        fixture_count = session.execute(
            select(func.count()).select_from(fpl_fixtures_table)
        ).scalar_one()
        metric_count = session.execute(
            select(func.count()).select_from(fpl_player_current_metrics_table)
        ).scalar_one()
        payload_count = session.execute(
            select(func.count()).select_from(external_payload_cache_table)
        ).scalar_one()
        fetch_count = session.execute(
            select(func.count()).select_from(external_fetch_log_table)
        ).scalar_one()
        assert player_count == 1
        assert team_count == 2
        assert gameweek_count == 1
        assert fixture_count == 1
        assert metric_count == 1
        assert payload_count == 2
        assert fetch_count == 4
        player = session.execute(select(fpl_players_table)).mappings().one()
        metrics = session.execute(select(fpl_player_current_metrics_table)).mappings().one()
        fixture = session.execute(select(fpl_fixtures_table)).mappings().one()
        assert player["id"] == "fpl-10"
        assert player["web_name"] == "Keeper"
        assert player["position_id"] == "GKP"
        assert metrics["total_points"] == 42
        assert metrics["form"] == 6.5
        assert metrics["chance_of_playing_next_round"] == 75
        assert fixture["home_team_id"] == "1"
        assert fixture["away_difficulty"] == 4

    status = repository.status()
    assert status.normalized_counts == {
        "gameweeks": 1,
        "teams": 2,
        "players": 1,
        "player_metrics": 1,
        "fixtures": 1,
    }
    assert all(resource.last_fetch_status == 200 for resource in status.resources)
    assert all(resource.last_updated_at is not None for resource in status.resources)


def test_player_history_enriches_fixture_context_and_conceded_points_from_cached_data() -> None:
    sessions = _session_factory()
    repository = PostgreSQLFplDataRepository(sessions)
    service = FplDataService(FakeClient(), repository)
    service.refresh(list(FplRefreshResource))
    with sessions() as session:
        session.execute(
            insert(fpl_players_table),
            [
                {
                    "id": f"fpl-{element_id}",
                    "first_name": "Opposition",
                    "second_name": f"Player {element_id}",
                    "web_name": f"Player {element_id}",
                    "position_id": "GKP",
                    "team_id": "1",
                }
                for element_id in (901, 902, 903)
            ],
        )
        session.commit()
    repository.persist_fixtures(
        [
            {
                "id": 98,
                "event": 0,
                "team_h": 2,
                "team_a": 1,
                "kickoff_time": "2026-08-08T14:00:00Z",
                "started": True,
                "finished": False,
                "finished_provisional": True,
                "team_h_difficulty": 3,
                "team_a_difficulty": 2,
                "team_h_score": 1,
                "team_a_score": 0,
            },
            {
                "id": 101,
                "event": 2,
                "team_h": 2,
                "team_a": 1,
                "kickoff_time": "2026-08-22T14:00:00Z",
                "started": False,
                "finished": False,
                "team_h_difficulty": 2,
                "team_a_difficulty": 4,
                "team_h_score": None,
                "team_a_score": None,
            },
            {
                "id": 102,
                "event": 3,
                "team_h": 2,
                "team_a": 1,
                "kickoff_time": "2026-08-29T14:00:00Z",
                "started": True,
                "finished": True,
                "finished_provisional": False,
                "team_h_difficulty": 2,
                "team_a_difficulty": 4,
                "team_h_score": 1,
                "team_a_score": 1,
            },
        ],
        endpoint="https://fantasy.premierleague.com/api/fixtures/",
        status_code=200,
        response_sha256="fixture-context-sha",
        fetched_at=datetime(2026, 8, 20, tzinfo=UTC),
    )

    response = service.player_history("fpl-10")

    assert isinstance(response, FplPlayerHistoryResponse)
    assert response.history[0].opponent_short_name == "AVL"
    assert response.history[0].difficulty == 2
    assert response.fixtures[0].opponent_short_name == "AVL"
    assert response.fixtures[0].opponent_team_id == 2
    assert response.fixtures[0].difficulty == 4
    assert response.fixtures[0].opponent_difficulty == 2
    assert response.opponent_defensive_history[0].opponent_short_name == "ARS"
    assert response.opponent_defensive_history[0].total_points_conceded == 15
    assert response.opponent_defensive_history[0].attacking_asset_points == 8
    assert response.opponent_defensive_history[0].defensive_asset_points == 7
    assert response.opponent_defensive_history[0].gameweek == 0
    assert [fixture.fixture_id for fixture in response.opponent_defensive_history] == [98, 100]
    assert response.opponent_defensive_history[1].total_points_conceded is None


def test_bootstrap_refresh_enriches_existing_canonical_draft_player_in_place() -> None:
    sessions = _session_factory()
    with sessions() as session:
        session.execute(
            insert(fpl_positions_table).values(
                id="GKP",
                singular_name="Goalkeeper",
                plural_name="Goalkeepers",
            )
        )
        session.execute(
            insert(epl_teams_table).values(
                id="seed-team",
                short_name="SEE",
                name="Seed Team",
            )
        )
        session.execute(
            insert(fpl_players_table).values(
                id="fpl-10",
                first_name="Seeded",
                second_name="Placeholder",
                web_name="Placeholder",
                position_id="GKP",
                team_id="seed-team",
            )
        )
        session.commit()

    service = FplDataService(FakeClient(), PostgreSQLFplDataRepository(sessions))
    service.refresh([FplRefreshResource.BOOTSTRAP_STATIC])

    with sessions() as session:
        players = list(session.execute(select(fpl_players_table)).mappings())
        assert len(players) == 1
        assert players[0]["id"] == "fpl-10"
        assert players[0]["first_name"] == "Test"
        assert players[0]["web_name"] == "Keeper"
        assert players[0]["team_id"] == "1"


def test_player_values_follow_active_gameweek_after_season_rollover() -> None:
    sessions = _session_factory()
    with sessions() as session:
        session.execute(
            insert(fpl_gameweeks_table).values(
                id="1",
                name="Gameweek 1",
                deadline_time=datetime(2026, 8, 21, 17, 30, tzinfo=UTC),
                is_previous=False,
                is_current=False,
                is_next=True,
                finished=False,
                data_checked=False,
            )
        )
        session.execute(
            insert(fpl_player_values_table),
            [
                {"id": "fpl-10:38", "player_id": "fpl-10", "gameweek": 38, "value": 999},
                {"id": "fpl-10:1", "player_id": "fpl-10", "gameweek": 1, "value": 55},
            ],
        )
        session.commit()

        active_values = _active_gameweek_player_values_subquery()
        value = session.execute(
            select(fpl_player_values_table.c.value)
            .join(
                active_values,
                (active_values.c.player_id == fpl_player_values_table.c.player_id)
                & (active_values.c.gameweek == fpl_player_values_table.c.gameweek),
            )
            .where(fpl_player_values_table.c.player_id == "fpl-10")
        ).scalar_one()

    assert value == 55


def test_player_history_fetches_once_then_uses_postgres_cache() -> None:
    sessions = _session_factory()
    repository = PostgreSQLFplDataRepository(sessions)
    client = FakeClient()
    service = FplDataService(client, repository)

    first = service.player_history("fpl-10")
    second = service.player_history("fpl-10")

    assert client.element_summary_calls == 1
    assert first == second
    assert first.history[0].gameweek == 1
    assert first.history[0].total_points == 8
    assert first.history[0].expected_assists == 0.42
    assert first.fixtures[0].gameweek == 2
    assert first.fixtures[0].difficulty == 3


def test_squad_fixture_enrichment_returns_next_opponent_and_home_away_context() -> None:
    sessions = _session_factory()
    repository = PostgreSQLFplDataRepository(sessions)
    repository.persist_bootstrap_static(
        {
            **BOOTSTRAP,
            "teams": [
                *BOOTSTRAP["teams"],
                {"id": 3, "short_name": "BHA", "name": "Brighton & Hove Albion"},
            ],
        },
        endpoint="https://fantasy.premierleague.com/api/bootstrap-static/",
        status_code=200,
        response_sha256="bootstrap-sha",
        fetched_at=datetime.now(UTC),
    )
    double_gameweek_fixtures = [
        *FIXTURES,
        {
            **FIXTURES[0],
            "id": 102,
            "team_h": 2,
            "team_a": 1,
            "kickoff_time": "2026-08-16T14:00:00Z",
        },
        {
            **FIXTURES[0],
            "id": 103,
            "event": 2,
            "team_h": 3,
            "team_a": 1,
            "kickoff_time": "2026-08-22T14:00:00Z",
        },
    ]
    repository.persist_fixtures(
        double_gameweek_fixtures,
        endpoint="https://fantasy.premierleague.com/api/fixtures/",
        status_code=200,
        response_sha256="fixtures-sha",
        fetched_at=datetime.now(UTC),
    )

    with sessions() as session:
        fixtures = PostgreSQLSquadRepository._next_fixtures_by_team(session)

    assert len(fixtures["1"]) == 2
    assert [fixture.opponent.short_name for fixture in fixtures["1"]] == ["AVL", "AVL"]
    assert [fixture.is_home for fixture in fixtures["1"]] == [True, False]
    assert [fixture.difficulty for fixture in fixtures["1"]] == [2, 4]
    assert len(fixtures["2"]) == 2
    assert [fixture.opponent.short_name for fixture in fixtures["2"]] == ["ARS", "ARS"]
    assert fixtures["3"] == []


def test_squad_fixture_selection_uses_one_official_next_gameweek_for_all_teams() -> None:
    sessions = _session_factory()
    repository = PostgreSQLFplDataRepository(sessions)
    repository.persist_bootstrap_static(
        {
            **BOOTSTRAP,
            "events": [
                BOOTSTRAP["events"][0],
                {
                    "id": 2,
                    "name": "Gameweek 2",
                    "deadline_time": "2026-08-21T17:30:00Z",
                    "is_previous": False,
                    "is_current": False,
                    "is_next": True,
                    "finished": False,
                    "data_checked": False,
                },
                {
                    "id": 3,
                    "name": "Gameweek 3",
                    "deadline_time": "2026-08-28T17:30:00Z",
                    "is_previous": False,
                    "is_current": False,
                    "is_next": False,
                    "finished": False,
                    "data_checked": False,
                },
            ],
            "teams": [
                *BOOTSTRAP["teams"],
                {"id": 3, "short_name": "BHA", "name": "Brighton & Hove Albion"},
            ],
        },
        endpoint="https://fantasy.premierleague.com/api/bootstrap-static/",
        status_code=200,
        response_sha256="bootstrap-next-gameweek-sha",
        fetched_at=datetime.now(UTC),
    )
    repository.persist_fixtures(
        [
            {
                **FIXTURES[0],
                "id": 200,
                "event": 2,
                "team_h": 1,
                "team_a": 2,
            },
            {
                **FIXTURES[0],
                "id": 201,
                "event": 3,
                "team_h": 3,
                "team_a": 1,
            },
        ],
        endpoint="https://fantasy.premierleague.com/api/fixtures/",
        status_code=200,
        response_sha256="fixtures-next-gameweek-sha",
        fetched_at=datetime.now(UTC),
    )

    with sessions() as session:
        fixtures = PostgreSQLSquadRepository._next_fixtures_by_team(session)

    assert [fixture.gameweek.number for fixture in fixtures["1"]] == [2]
    assert [fixture.opponent.short_name for fixture in fixtures["1"]] == ["AVL"]
    assert [fixture.gameweek.number for fixture in fixtures["2"]] == [2]
    assert [fixture.opponent.short_name for fixture in fixtures["2"]] == ["ARS"]
    assert fixtures["3"] == []


def test_repository_records_fetch_failure_without_marking_freshness() -> None:
    sessions = _session_factory()
    repository = PostgreSQLFplDataRepository(sessions)
    now = datetime.now(UTC)

    repository.record_failure(
        resource=FplRefreshResource.FIXTURES,
        endpoint="https://fantasy.premierleague.com/api/fixtures/",
        fetched_at=now,
        error="upstream unavailable",
    )

    status = repository.status()
    fixture_status = next(
        item for item in status.resources if item.resource is FplRefreshResource.FIXTURES
    )
    assert fixture_status.last_updated_at is None
    assert fixture_status.last_fetch_status is None
    assert fixture_status.last_fetch_error == "upstream unavailable"
