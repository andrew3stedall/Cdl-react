from datetime import UTC, datetime

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.contracts.fpl_data import FplRefreshResource
from cdl_api.fpl_client import FplApiResponse
from cdl_api.repositories.postgres_fpl_data import (
    PostgreSQLFplDataRepository,
    external_fetch_log_table,
    external_payload_cache_table,
    fpl_fixtures_table,
    fpl_gameweeks_table,
)
from cdl_api.repositories.postgres_league_fpl import (
    epl_teams_table,
    fpl_cache_freshness_table,
    fpl_player_availability_table,
    fpl_player_values_table,
    fpl_players_table,
    fpl_positions_table,
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
            "status": "a",
            "news": "",
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


class FakeClient:
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

    with sessions() as session:
        player_count = session.execute(
            select(func.count()).select_from(fpl_players_table)
        ).scalar_one()
        team_count = session.execute(
            select(func.count()).select_from(epl_teams_table)
        ).scalar_one()
        gameweek_count = session.execute(
            select(func.count()).select_from(fpl_gameweeks_table)
        ).scalar_one()
        fixture_count = session.execute(
            select(func.count()).select_from(fpl_fixtures_table)
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
        assert payload_count == 2
        assert fetch_count == 4
        player = session.execute(select(fpl_players_table)).mappings().one()
        fixture = session.execute(select(fpl_fixtures_table)).mappings().one()
        assert player["web_name"] == "Keeper"
        assert player["position_id"] == "GKP"
        assert fixture["home_team_id"] == "1"
        assert fixture["away_difficulty"] == 4

    status = repository.status()
    assert status.normalized_counts == {
        "gameweeks": 1,
        "teams": 2,
        "players": 1,
        "fixtures": 1,
    }
    assert all(resource.last_fetch_status == 200 for resource in status.resources)
    assert all(resource.last_updated_at is not None for resource in status.resources)


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
