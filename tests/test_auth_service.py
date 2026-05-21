from cdl_api.contracts.auth import LoginRequest
from cdl_api.repositories.auth import InMemorySessionRepository, InMemoryUserRepository
from cdl_api.services.auth import AuthenticationService


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
