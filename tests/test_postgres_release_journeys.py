"""Real PostgreSQL release journey: two authenticated managers and isolated edits."""

from __future__ import annotations

import os
from hashlib import sha256
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, update

from cdl_api.app import create_app
from cdl_api.database import build_session_factory
from cdl_api.google_identity import GoogleIdentity
from cdl_api.repositories.league_memberships import league_invites_table
from cdl_api.repositories.postgres_auth import (
    PostgreSQLUserRepository,
    sessions_table,
    users_table,
)
from cdl_api.repositories.postgres_league_fpl import managers_table
from cdl_api.repositories.postgres_team_selection import (
    team_selection_chips_table,
    team_selection_lineup_slots_table,
)
from cdl_api.routers.auth import get_google_identity_verifier
from cdl_api.seed_staging import seed_synthetic_staging_data
from cdl_api.settings import Settings, get_settings
from cdl_api.staging_draft_seed import SEASON_ID, STAGING_COMMISSIONER_EMAIL


def test_postgres_two_manager_auth_invite_lineup_chip_round_trip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_url = os.environ.get("CDL_DATABASE_URL", "")
    if not database_url.startswith(("postgresql://", "postgresql+psycopg://")):
        pytest.skip(
            "This release journey requires the PostgreSQL service from backend-postgres.yml."
        )

    settings = Settings(
        environment="staging",
        repository_mode="postgres",
        database_url=database_url,
        session_cookie_secure=True,
        development_login_secret=f"test-only-{uuid4().hex}",
        google_allowed_emails=(
            f"{STAGING_COMMISSIONER_EMAIL},manager@example.com,seed-reviewer@example.com"
        ),
        commissioner_emails="manager@example.com",
    )
    monkeypatch.setenv("CDL_ENVIRONMENT", settings.environment)
    monkeypatch.setenv("CDL_REPOSITORY_MODE", settings.repository_mode)
    monkeypatch.setenv("CDL_DATABASE_URL", database_url)
    monkeypatch.setenv("CDL_SESSION_COOKIE_SECURE", "true")
    monkeypatch.setenv("CDL_DEVELOPMENT_LOGIN_SECRET", settings.development_login_secret)
    monkeypatch.setenv("CDL_GOOGLE_CLIENT_ID", "test-only-google-client")
    monkeypatch.setenv("CDL_GOOGLE_ALLOWED_EMAILS", settings.google_allowed_emails)
    monkeypatch.setenv("CDL_COMMISSIONER_EMAILS", settings.commissioner_emails)
    monkeypatch.setenv("CDL_ALLOW_SYNTHETIC_STAGING_SEED", "true")
    seed_synthetic_staging_data(settings)

    session_factory = build_session_factory(settings)
    user_repository = PostgreSQLUserRepository(session_factory)
    manager_email = f"postgres-release-{uuid4().hex}@example.test"

    class TestGoogleIdentityVerifier:
        def verify(
            self,
            credential: str,
            *,
            allow_unlisted_email: bool = False,
        ) -> GoogleIdentity | None:
            if credential != "verified-release-journey-token" or not allow_unlisted_email:
                return None
            return GoogleIdentity(
                subject=f"release-journey-{uuid4().hex}",
                email=manager_email,
                display_name="Release Manager",
            )

    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_google_identity_verifier] = lambda: TestGoogleIdentityVerifier()

    commissioner = TestClient(app, base_url="https://testserver")
    manager = TestClient(app, base_url="https://testserver")
    invite_token: str | None = None
    invited_team_id: str | None = None
    manager_record = None
    commissioner_session: str | None = None

    try:
        login = commissioner.post(
            "/api/auth/login",
            json={"email": "manager@example.com", "password": settings.development_login_secret},
        )
        assert login.status_code == 200
        commissioner_session = commissioner.cookies.get(settings.session_cookie_name)
        auth = manager.get("/api/auth/session")
        assert auth.status_code == 200
        assert auth.json()["is_authenticated"] is False

        manager_a_before = commissioner.get("/api/team-selection")
        assert manager_a_before.status_code == 200
        commissioner_team_id = manager_a_before.json()["manager_team"]["id"]

        management = commissioner.get("/api/league/management")
        assert management.status_code == 200
        target = next(team for team in management.json()["teams"] if not team["is_assigned"])
        invited_team_id = target["team_id"]

        invite = commissioner.post(
            "/api/league/management/invites", json={"team_id": invited_team_id}
        )
        assert invite.status_code == 200
        invite_token = invite.json()["token"]
        assert manager.get(f"/api/league/invites/{invite_token}").status_code == 200
        google_login = manager.post(
            "/api/auth/google",
            headers={"X-CDL-Google-Sign-In": "1"},
            json={"credential": "verified-release-journey-token", "invite_token": invite_token},
        )
        assert google_login.status_code == 200
        assert google_login.json()["session"]["is_authenticated"] is True
        manager_record = user_repository.get_by_email(manager_email)
        assert manager_record is not None
        auth = manager.get("/api/auth/session")
        assert auth.status_code == 200
        assert auth.json()["is_authenticated"] is True
        assert auth.json()["user"]["id"] == manager_record.id
        accepted = manager.post(f"/api/league/invites/{invite_token}/accept")
        assert accepted.status_code == 200
        assert accepted.json()["team_id"] == invited_team_id

        manager_b_before = manager.get("/api/team-selection")
        assert manager_b_before.status_code == 200
        before_snapshot = manager_b_before.json()
        assert before_snapshot["manager_team"]["id"] == invited_team_id
        assert len(before_snapshot["lineup"]) == 20
        assert len(before_snapshot["chips"]) == 5
        assert commissioner_team_id != invited_team_id

        lineup = before_snapshot["lineup"]
        starter_ids = [player["id"] for player in lineup if player["slot"] == "starter"]
        assert len(starter_ids) >= 2
        captain_id = next(
            (player["id"] for player in lineup if player["is_captain"]), starter_ids[0]
        )
        next_captain_id = next(
            player["id"]
            for player in lineup
            if player["slot"] == "starter"
            and player["id"] != captain_id
            and not player["is_vice_captain"]
        )
        payload = {
            "players": [
                {
                    "player_id": player["id"],
                    "slot": player["slot"],
                    "slot_order": player["slot_order"],
                    "is_captain": player["slot"] == "starter" and player["id"] == next_captain_id,
                    "is_vice_captain": player["is_vice_captain"],
                }
                for player in lineup
            ]
        }
        saved = manager.put("/api/team-selection/lineup", json=payload)
        assert saved.status_code == 200, saved.text
        reloaded = manager.get("/api/team-selection").json()
        assert (
            next(player for player in reloaded["lineup"] if player["is_captain"])["id"]
            == next_captain_id
        )

        chip = manager.put("/api/team-selection/chips/triple-captain", json={"active": True})
        assert chip.status_code == 200
        manager_b_after = manager.get("/api/team-selection").json()
        assert (
            next(item for item in manager_b_after["chips"] if item["id"] == "triple-captain")[
                "status"
            ]
            == "active"
        )
        manager_a_after = commissioner.get("/api/team-selection").json()
        assert manager_a_after["manager_team"]["id"] == commissioner_team_id
        assert all(item["status"] != "active" for item in manager_a_after["chips"])
        assert (
            next(player for player in manager_a_after["lineup"] if player["is_captain"])["id"]
            == next(player for player in manager_a_before.json()["lineup"] if player["is_captain"])[
                "id"
            ]
        )
    finally:
        commissioner.close()
        manager.close()
        app.dependency_overrides.clear()
        token_hash = sha256(invite_token.encode()).hexdigest() if invite_token else None
        with session_factory() as session:
            if commissioner_session:
                session.execute(
                    delete(sessions_table).where(sessions_table.c.id == commissioner_session)
                )
            if manager_record:
                session.execute(
                    update(managers_table)
                    .where(managers_table.c.user_id == manager_record.id)
                    .values(user_id=None)
                )
                session.execute(
                    delete(sessions_table).where(sessions_table.c.user_id == manager_record.id)
                )
                session.execute(delete(users_table).where(users_table.c.id == manager_record.id))
            if invited_team_id:
                session.execute(
                    delete(team_selection_lineup_slots_table).where(
                        team_selection_lineup_slots_table.c.season_id == SEASON_ID,
                        team_selection_lineup_slots_table.c.draft_team_id == invited_team_id,
                    )
                )
                session.execute(
                    delete(team_selection_chips_table).where(
                        team_selection_chips_table.c.season_id == SEASON_ID,
                        team_selection_chips_table.c.draft_team_id == invited_team_id,
                    )
                )
            if token_hash:
                session.execute(
                    delete(league_invites_table).where(
                        league_invites_table.c.token_hash == token_hash
                    )
                )
            session.commit()
