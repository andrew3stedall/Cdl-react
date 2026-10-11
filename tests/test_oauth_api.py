"""HTTP behavior for OAuth discovery, consent, code exchange and revocation."""

from urllib.parse import parse_qs, urlsplit

from fastapi import FastAPI
from fastapi.testclient import TestClient

from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.oauth import InMemoryOAuthRepository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.oauth import get_oauth_service, router
from cdl_api.services.oauth import OAuthService
from cdl_api.settings import Settings, get_settings


def test_discovery_registration_consent_and_revoke_flow() -> None:
    repository = InMemoryOAuthRepository()
    service = OAuthService(repository, "https://cdl.example", "s" * 40)
    settings = Settings(
        mcp_oauth_enabled=True,
        oauth_issuer_url="https://cdl.example",
        oauth_signing_secret="s" * 40,
    )
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_oauth_service] = lambda: service
    app.dependency_overrides[require_authenticated_session] = lambda: SessionUser(
        id="user-1", email="manager@example.com", display_name="Manager"
    )
    client = TestClient(app)

    discovery = client.get("/.well-known/oauth-authorization-server")
    assert discovery.status_code == 200
    assert discovery.json()["code_challenge_methods_supported"] == ["S256"]
    assert discovery.json()["issuer"] == "https://cdl.example"
    assert "offline_access" in discovery.json()["scopes_supported"]

    registration = client.post(
        "/oauth/register",
        json={
            "client_name": "Test Assistant",
            "redirect_uris": ["https://assistant.example/callback"],
        },
    )
    assert registration.status_code == 201
    client_id = registration.json()["client_id"]

    import base64
    import hashlib

    verifier = "z" * 43
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    )
    auth_params = {
        "client_id": client_id,
        "redirect_uri": "https://assistant.example/callback",
        "response_type": "code",
        "scope": "cdl:read offline_access",
        "state": "state-value",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    consent = client.get("/oauth/authorize", params=auth_params)
    assert consent.status_code == 200
    assert "Test Assistant" in consent.text
    assert "not verified" in consent.text
    csrf = client.cookies.get("cdl_oauth_consent")
    decision = client.post(
        "/oauth/authorize/decision",
        data={
            **auth_params,
            "csrf_token": csrf,
            "decision": "allow",
            "grant_scope": ["cdl:read"],
        },
        follow_redirects=False,
    )
    assert decision.status_code == 302
    query = parse_qs(urlsplit(decision.headers["location"]).query)
    assert query["state"] == ["state-value"]
    assert query["iss"] == ["https://cdl.example"]
    assert query["iss"] == ["https://cdl.example"]

    tokens = client.post(
        "/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": client_id,
            "code": query["code"][0],
            "redirect_uri": auth_params["redirect_uri"],
            "code_verifier": verifier,
        },
    )
    assert tokens.status_code == 200
    assert tokens.json()["token_type"] == "Bearer"  # noqa: S105
    assert tokens.json()["scope"] == "cdl:read"
    assert tokens.json()["refresh_token"]
    connection_id = service.validate_access_token(tokens.json()["access_token"])["connection_id"]

    connections = client.get("/oauth/connections")
    assert connections.status_code == 200
    assert connections.json()[0]["client_name"] == "Test Assistant"
    revoked = client.delete(f"/oauth/connections/{connection_id}")
    assert revoked.status_code == 204
    try:
        service.validate_access_token(tokens.json()["access_token"])
    except ValueError as error:
        assert "revoked" in str(error)
    else:
        raise AssertionError("Revoked connection continued to validate its access token.")
