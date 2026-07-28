import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.postgres_preferences import PostgreSQLUserPreferenceRepository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.preferences import get_preference_service
from cdl_api.services.preferences import UserPreferenceService


def _user(user_id: str) -> SessionUser:
    return SessionUser(
        id=user_id,
        email=f"{user_id}@example.com",
        display_name=user_id,
        roles=["manager"],
    )


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_authenticated_preferences_persist_and_remain_isolated() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)
    with engine.begin() as connection:
        connection.execute(
            text(
                "DELETE FROM user_preferences "
                "WHERE user_id IN ('preferences-manager-1', 'preferences-manager-2')"
            )
        )

    repository = PostgreSQLUserPreferenceRepository(session_factory)
    app = create_app()
    app.dependency_overrides[get_preference_service] = lambda: UserPreferenceService(repository)
    app.dependency_overrides[require_authenticated_session] = lambda: _user(
        "preferences-manager-1"
    )
    client = TestClient(app)

    assert client.put(
        "/api/me/preferences", json={"theme_preset": "dark"}
    ).json() == {"theme_preset": "dark"}

    app.dependency_overrides[require_authenticated_session] = lambda: _user(
        "preferences-manager-2"
    )
    assert client.get("/api/me/preferences").json() == {"theme_preset": "classic"}
    assert client.put(
        "/api/me/preferences", json={"theme_preset": "compact"}
    ).json() == {"theme_preset": "compact"}

    reloaded_repository = PostgreSQLUserPreferenceRepository(session_factory)
    assert reloaded_repository.get_for_user("preferences-manager-1").theme_preset == "dark"
    assert reloaded_repository.get_for_user("preferences-manager-2").theme_preset == "compact"

    with engine.begin() as connection:
        connection.execute(
            text(
                "DELETE FROM user_preferences "
                "WHERE user_id IN ('preferences-manager-1', 'preferences-manager-2')"
            )
        )
    engine.dispose()
