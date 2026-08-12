import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, insert, text
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.postgres_auth import users_table
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
    user_ids = ("preferences-manager-1", "preferences-manager-2")
    with engine.begin() as connection:
        connection.execute(
            text(
                "DELETE FROM user_preferences "
                "WHERE user_id IN ('preferences-manager-1', 'preferences-manager-2')"
            )
        )
        connection.execute(
            text(
                "DELETE FROM sessions "
                "WHERE user_id IN ('preferences-manager-1', 'preferences-manager-2')"
            )
        )
        connection.execute(
            text("DELETE FROM users WHERE id IN ('preferences-manager-1', 'preferences-manager-2')")
        )
        connection.execute(
            insert(users_table),
            [
                {
                    "id": user_id,
                    "email": f"{user_id}@example.com",
                    "display_name": user_id,
                    "roles": ["manager"],
                }
                for user_id in user_ids
            ],
        )

    repository = PostgreSQLUserPreferenceRepository(session_factory)
    app = create_app()
    app.dependency_overrides[get_preference_service] = lambda: UserPreferenceService(repository)
    app.dependency_overrides[require_authenticated_session] = lambda: _user("preferences-manager-1")
    client = TestClient(app)

    assert client.put(
        "/api/me/preferences",
        json={
            "theme_preset": "teal-dark",
            "attack_direction": "down",
            "fdr_scale": "Viridis",
            "fdr_scale_reversed": False,
            "fdr_display_mode": "fill",
        },
    ).json() == {
        "theme_preset": "teal-dark",
        "attack_direction": "down",
        "fdr_scale": "Viridis",
        "fdr_scale_reversed": False,
        "fdr_display_mode": "fill",
    }

    app.dependency_overrides[require_authenticated_session] = lambda: _user("preferences-manager-2")
    assert client.get("/api/me/preferences").json() == {
        "theme_preset": "teal-light",
        "attack_direction": "up",
        "fdr_scale": "RdYlGn",
        "fdr_scale_reversed": True,
        "fdr_display_mode": "font",
    }
    assert client.put(
        "/api/me/preferences",
        json={
            "theme_preset": "teal-dark",
            "attack_direction": "up",
            "fdr_scale": "Rainbow",
            "fdr_scale_reversed": True,
            "fdr_display_mode": "font",
        },
    ).json() == {
        "theme_preset": "teal-dark",
        "attack_direction": "up",
        "fdr_scale": "Rainbow",
        "fdr_scale_reversed": True,
        "fdr_display_mode": "font",
    }

    reloaded_repository = PostgreSQLUserPreferenceRepository(session_factory)
    assert reloaded_repository.get_for_user("preferences-manager-1").theme_preset == "teal-dark"
    assert reloaded_repository.get_for_user("preferences-manager-1").attack_direction == "down"
    assert reloaded_repository.get_for_user("preferences-manager-1").fdr_scale == "Viridis"
    assert reloaded_repository.get_for_user("preferences-manager-1").fdr_scale_reversed is False
    assert reloaded_repository.get_for_user("preferences-manager-2").theme_preset == "teal-dark"
    assert reloaded_repository.get_for_user("preferences-manager-2").attack_direction == "up"
    assert reloaded_repository.get_for_user("preferences-manager-2").fdr_scale == "Rainbow"
    assert reloaded_repository.get_for_user("preferences-manager-2").fdr_scale_reversed is True

    with engine.begin() as connection:
        connection.execute(
            text(
                "DELETE FROM user_preferences "
                "WHERE user_id IN ('preferences-manager-1', 'preferences-manager-2')"
            )
        )
        connection.execute(
            text(
                "DELETE FROM sessions "
                "WHERE user_id IN ('preferences-manager-1', 'preferences-manager-2')"
            )
        )
        connection.execute(
            text("DELETE FROM users WHERE id IN ('preferences-manager-1', 'preferences-manager-2')")
        )
    engine.dispose()
