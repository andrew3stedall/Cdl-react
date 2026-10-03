import pytest

from cdl_api.contracts.auth import LoginRequest
from cdl_api.google_identity import GoogleIdentity
from cdl_api.repositories.auth import InMemorySessionRepository, InMemoryUserRepository
from cdl_api.repositories.passkeys import (
    InMemoryAuthChallengeRepository,
    InMemoryPasskeyRepository,
    PasskeyRecord,
)
from cdl_api.services.auth import AuthenticationService
from cdl_api.services.passkeys import PasskeyError, PasskeyService


def build_service() -> AuthenticationService:
    return AuthenticationService(
        users=InMemoryUserRepository(),
        sessions=InMemorySessionRepository(),
        development_secret="demo-login-secret",
    )


def test_login_creates_authenticated_session() -> None:
    service = build_service()
    result = service.login(LoginRequest(email="manager@example.com", password="demo-login-secret"))

    assert result is not None
    session_id, session = result
    assert session_id
    assert session.is_authenticated is True
    assert session.user is not None
    assert session.user.email == "manager@example.com"


def test_login_rejects_invalid_credentials() -> None:
    service = build_service()
    result = service.login(LoginRequest(email="manager@example.com", password="wrong"))

    assert result is None


def test_logout_invalidates_session() -> None:
    service = build_service()
    result = service.login(LoginRequest(email="manager@example.com", password="demo-login-secret"))
    assert result is not None
    session_id, _ = result

    logged_out = service.logout(session_id)
    session = service.get_session(session_id)

    assert logged_out.is_authenticated is False
    assert session.is_authenticated is False


def test_google_login_creates_allowlisted_identity_session() -> None:
    service = build_service()

    session_id, session = service.login_google(
        GoogleIdentity(
            subject="google-subject-1",
            email="andrew3stedall@gmail.com",
            display_name="Andrew Stedall",
        )
    )

    assert session_id
    assert session.user is not None
    assert session.user.email == "andrew3stedall@gmail.com"
    assert session.user.roles == ["manager"]
    assert service.get_session(session_id).is_authenticated is True


def test_sessions_are_persistent_and_expose_expiry() -> None:
    service = build_service()

    result = service.login(LoginRequest(email="manager@example.com", password="demo-login-secret"))

    assert result is not None
    session_id, session = result
    assert session.expires_at is not None
    assert service.get_session(session_id).expires_at == session.expires_at


def test_session_roles_include_only_current_league_membership_capability() -> None:
    class Memberships:
        roles_by_user = {"user-1": "vice_commissioner"}
        user_ids: list[str] = []

        def access_for_user(self, user_id: str) -> object | None:
            self.user_ids.append(user_id)
            role = self.roles_by_user.get(user_id)
            return None if role is None else type("Access", (), {"role": role})()

    users = InMemoryUserRepository()
    memberships = Memberships()
    service = AuthenticationService(
        users=users,
        sessions=InMemorySessionRepository(),
        development_secret="demo-login-secret",
        league_memberships=memberships,
    )
    result = service.login_google(
        GoogleIdentity(
            subject="member-subject",
            email="manager@example.com",
            display_name="Manager",
        )
    )
    session_id, login_session = result
    assert login_session.user is not None
    user_id = login_session.user.id
    assert "vice_commissioner" in login_session.user.roles

    memberships.roles_by_user = {"unrelated-user": "commissioner"}
    refreshed = service.get_session(session_id)

    assert refreshed.user is not None
    assert "vice_commissioner" not in refreshed.user.roles
    assert "commissioner" not in refreshed.user.roles
    assert memberships.user_ids == [user_id, user_id]


def test_passkey_options_use_discoverable_user_verified_credentials() -> None:
    service = PasskeyService(
        InMemoryPasskeyRepository(),
        InMemoryAuthChallengeRepository(),
        InMemoryUserRepository(),
        rp_id="staging.example.test",
        rp_name="Castle Draft League",
        expected_origin="https://staging.example.test",
    )

    options, challenge_id = service.registration_options(
        "user-1",
        "manager@example.com",
        "Demo Manager",
    )

    assert options["rp"]["id"] == "staging.example.test"
    assert options["authenticatorSelection"]["residentKey"] == "required"
    assert options["authenticatorSelection"]["userVerification"] == "required"
    assert challenge_id


def test_passkey_revoke_is_owner_scoped_and_removes_credential() -> None:
    credentials = InMemoryPasskeyRepository()
    credentials.create(
        PasskeyRecord(
            credential_id="cred-1",
            user_id="user-1",
            public_key=b"public-key",
            sign_count=0,
        )
    )
    service = PasskeyService(
        credentials,
        InMemoryAuthChallengeRepository(),
        InMemoryUserRepository(),
        rp_id="staging.example.test",
        rp_name="Castle Draft League",
        expected_origin="https://staging.example.test",
    )

    with pytest.raises(PasskeyError, match="could not be found"):
        service.revoke("other-user", "cred-1")

    service.revoke("user-1", "cred-1")
    assert service.registered_passkeys("user-1") == []
