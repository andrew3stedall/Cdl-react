"""Security properties for the MCP OAuth authorization server."""

import base64
import hashlib

import pytest

from cdl_api.repositories.oauth import InMemoryOAuthRepository
from cdl_api.services.oauth import OAuthError, OAuthService, validate_redirect_uri


def pkce_pair() -> tuple[str, str]:
    verifier = "a" * 43
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    )
    return verifier, challenge


def create_authorization(
    service: OAuthService, client_id: str, user_id: str = "user-1"
) -> tuple[str, str]:
    verifier, challenge = pkce_pair()
    service.authorize_request(
        client_id=client_id,
        redirect_uri="https://assistant.example/callback",
        response_type="code",
        scope="cdl:read cdl:write",
        state="random-state",
        code_challenge=challenge,
        code_challenge_method="S256",
    )
    code = service.issue_code(
        user_id=user_id,
        client_id=client_id,
        redirect_uri="https://assistant.example/callback",
        scopes=["cdl:read", "cdl:write"],
        code_challenge=challenge,
    )
    return code, verifier


def service_and_client() -> tuple[OAuthService, InMemoryOAuthRepository, str]:
    repository = InMemoryOAuthRepository()
    service = OAuthService(repository, "https://cdl.example", "x" * 40)
    client = service.register_client("Assistant", ["https://assistant.example/callback"])
    return service, repository, str(client["client_id"])


def test_pkce_code_is_single_use_and_access_token_is_audience_and_scope_bound() -> None:
    service, repository, client_id = service_and_client()
    code, verifier = create_authorization(service, client_id)
    tokens = service.exchange_code(
        client_id=client_id,
        code=code,
        redirect_uri="https://assistant.example/callback",
        code_verifier=verifier,
    )
    claims = service.validate_access_token(tokens["access_token"], {"cdl:write"})
    assert claims["aud"] == "cdl-mcp"
    assert claims["sub"] == "user-1"
    assert repository.list_connections("user-1")[0]["client_name"] == "Assistant"
    with pytest.raises(OAuthError, match="invalid or the verifier"):
        service.exchange_code(
            client_id=client_id,
            code=code,
            redirect_uri="https://assistant.example/callback",
            code_verifier=verifier,
        )
    read_verifier, read_challenge = pkce_pair()
    read_code = service.issue_code(
        user_id="user-1",
        client_id=client_id,
        redirect_uri="https://assistant.example/callback",
        scopes=["cdl:read"],
        code_challenge=read_challenge,
    )
    read_tokens = service.exchange_code(
        client_id=client_id,
        code=read_code,
        redirect_uri="https://assistant.example/callback",
        code_verifier=read_verifier,
    )
    with pytest.raises(OAuthError, match="required scope"):
        service.validate_access_token(read_tokens["access_token"], {"cdl:write"})


def test_rfc7009_revokes_only_a_token_from_the_requesting_client() -> None:
    service, _, client_id = service_and_client()
    other = service.register_client("Other", ["https://other.example/callback"])
    code, verifier = create_authorization(service, client_id)
    tokens = service.exchange_code(
        client_id=client_id,
        code=code,
        redirect_uri="https://assistant.example/callback",
        code_verifier=verifier,
    )
    service.revoke_token(tokens["refresh_token"], client_id=str(other["client_id"]))
    service.validate_access_token(tokens["access_token"])
    service.revoke_token(tokens["refresh_token"], client_id=client_id)
    with pytest.raises(OAuthError, match="revoked"):
        service.validate_access_token(tokens["access_token"])


def test_pkce_mismatch_fails_and_another_client_cannot_exchange_the_code() -> None:
    service, _, client_id = service_and_client()
    other = service.register_client("Other", ["https://other.example/callback"])
    code, verifier = create_authorization(service, client_id)
    with pytest.raises(OAuthError, match="invalid or the verifier"):
        service.exchange_code(
            client_id=str(other["client_id"]),
            code=code,
            redirect_uri="https://other.example/callback",
            code_verifier=verifier,
        )
    code, verifier = create_authorization(service, client_id)
    with pytest.raises(OAuthError, match="invalid or the verifier"):
        service.exchange_code(
            client_id=client_id,
            code=code,
            redirect_uri="https://assistant.example/callback",
            code_verifier="b" * 43,
        )
    tokens = service.exchange_code(
        client_id=client_id,
        code=code,
        redirect_uri="https://assistant.example/callback",
        code_verifier=verifier,
    )
    service.validate_access_token(tokens["access_token"])


def test_refresh_rotation_detects_replay_and_revokes_the_connection() -> None:
    service, repository, client_id = service_and_client()
    code, verifier = create_authorization(service, client_id)
    tokens = service.exchange_code(
        client_id=client_id,
        code=code,
        redirect_uri="https://assistant.example/callback",
        code_verifier=verifier,
    )
    rotated = service.refresh(client_id=client_id, refresh_token=tokens["refresh_token"])
    service.validate_access_token(rotated["access_token"])
    with pytest.raises(OAuthError, match="invalid or revoked"):
        service.refresh(client_id=client_id, refresh_token=tokens["refresh_token"])
    with pytest.raises(OAuthError, match="revoked"):
        service.validate_access_token(rotated["access_token"])
    assert repository.list_connections("user-1") == []


def test_scopes_redirects_and_multi_client_connections_are_restricted() -> None:
    service, _, client_id = service_and_client()
    with pytest.raises(OAuthError, match="redirect URI"):
        service.authorize_request(
            client_id=client_id,
            redirect_uri="https://attacker.example/callback",
            response_type="code",
            scope="cdl:read",
            state="state",
            code_challenge=pkce_pair()[1],
            code_challenge_method="S256",
        )
    with pytest.raises(OAuthError, match="scope"):
        service.authorize_request(
            client_id=client_id,
            redirect_uri="https://assistant.example/callback",
            response_type="code",
            scope="admin",
            state="state",
            code_challenge=pkce_pair()[1],
            code_challenge_method="S256",
        )
    second = service.register_client("Second", ["https://second.example/callback"])
    for selected_client, uri in (
        (client_id, "https://assistant.example/callback"),
        (str(second["client_id"]), "https://second.example/callback"),
    ):
        verifier, challenge = pkce_pair()
        code = service.issue_code(
            user_id="user-1",
            client_id=selected_client,
            redirect_uri=uri,
            scopes=["cdl:read"],
            code_challenge=challenge,
        )
        service.exchange_code(
            client_id=selected_client, code=code, redirect_uri=uri, code_verifier=verifier
        )
    assert len(service.list_connections("user-1")) == 2


def test_redirect_uri_allows_only_https_or_loopback_http() -> None:
    assert validate_redirect_uri("https://assistant.example/callback")
    assert validate_redirect_uri("http://127.0.0.1:3456/callback")
    for uri in (
        "http://assistant.example/callback",
        "https://assistant.example/callback#fragment",
        "https://assistant.example:invalid/callback",
    ):
        with pytest.raises(OAuthError):
            validate_redirect_uri(uri)
    service, _, _ = service_and_client()
    with pytest.raises(OAuthError, match="blank"):
        service.register_client("   ", ["https://assistant.example/callback"])
