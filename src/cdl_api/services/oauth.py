"""OAuth 2.0 authorization-code service for MCP public clients."""

import base64
import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit
from uuid import uuid4

import jwt

from cdl_api.repositories.oauth import token_hash

APPLICATION_SCOPES = frozenset({"cdl:read", "cdl:write"})
ALLOWED_SCOPES = APPLICATION_SCOPES | {"offline_access"}
ACCESS_TOKEN_SECONDS = 900
AUTHORIZATION_CODE_SECONDS = 300
REFRESH_TOKEN_DAYS = 30
_VERIFIER_PATTERN = re.compile(r"^[A-Za-z0-9._~-]{43,128}$")
_CHALLENGE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")


class OAuthError(ValueError):
    """Expected OAuth request failure with an RFC 6749 error code."""

    def __init__(self, error: str, description: str = "") -> None:
        super().__init__(description or error)
        self.error = error
        self.description = description or error


def validate_redirect_uri(uri: str) -> str:
    parsed = urlsplit(uri)
    if (
        parsed.fragment
        or parsed.username
        or parsed.password
        or not parsed.hostname
        or parsed.scheme not in {"https", "http"}
    ):
        raise OAuthError("invalid_redirect_uri", "Redirect URI must be an absolute HTTPS URL.")
    try:
        if parsed.port is not None and not 1 <= parsed.port <= 65535:
            raise ValueError("port must be within the valid TCP range")
    except ValueError as exc:
        raise OAuthError("invalid_redirect_uri", "Redirect URI has an invalid port.") from exc
    if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise OAuthError(
            "invalid_redirect_uri", "HTTP redirect URIs are allowed only for loopback."
        )
    if any(char in uri for char in "\r\n"):
        raise OAuthError("invalid_redirect_uri", "Redirect URI is invalid.")
    return uri


class OAuthService:
    def __init__(self, repository: object, issuer: str, signing_secret: str) -> None:
        if len(signing_secret.encode("utf-8")) < 32:
            raise ValueError("OAuth token signing secret must contain at least 32 bytes.")
        issuer_parts = urlsplit(issuer)
        if (
            issuer_parts.scheme not in {"https", "http"}
            or not issuer_parts.hostname
            or issuer_parts.path not in {"", "/"}
            or issuer_parts.query
            or issuer_parts.fragment
            or (
                issuer_parts.scheme == "http"
                and issuer_parts.hostname not in {"localhost", "127.0.0.1", "::1"}
            )
        ):
            raise ValueError(
                "OAuth issuer must be an HTTPS origin, or a loopback HTTP origin for development."
            )
        self._repository = repository
        self._issuer = issuer.rstrip("/")
        self._secret = signing_secret

    @property
    def issuer(self) -> str:
        return self._issuer

    def register_client(self, name: str, redirect_uris: list[str]) -> dict[str, object]:
        name = name.strip()
        if not name:
            raise OAuthError("invalid_client_metadata", "Client name must not be blank.")
        if not redirect_uris or len(set(redirect_uris)) != len(redirect_uris):
            raise OAuthError("invalid_client_metadata", "Provide unique redirect URIs.")
        if any(len(uri) > 2048 for uri in redirect_uris):
            raise OAuthError(
                "invalid_client_metadata", "Redirect URIs may not exceed 2048 characters."
            )
        safe_uris = [validate_redirect_uri(uri) for uri in redirect_uris]
        return self._repository.register_client(name, safe_uris)

    def authorize_request(
        self,
        *,
        client_id: str,
        redirect_uri: str,
        response_type: str,
        scope: str,
        state: str | None,
        code_challenge: str,
        code_challenge_method: str,
    ) -> tuple[dict[str, object], list[str]]:
        client = self._repository.get_client(client_id)
        if not client:
            raise OAuthError("invalid_client", "The client is not registered.")
        if redirect_uri not in client["redirect_uris"]:
            raise OAuthError(
                "invalid_request", "The redirect URI is not registered for this client."
            )
        if response_type != "code":
            raise OAuthError(
                "unsupported_response_type", "Only the authorization code flow is supported."
            )
        requested_scopes = sorted(set(scope.split()))
        if (
            not requested_scopes
            or not set(requested_scopes).issubset(ALLOWED_SCOPES)
            or not set(requested_scopes).intersection(APPLICATION_SCOPES)
        ):
            raise OAuthError(
                "invalid_scope",
                "Requested scope must include cdl:read and/or cdl:write; offline_access is optional.",
            )
        if not state or len(state) > 512:
            raise OAuthError("invalid_request", "A transaction-specific state value is required.")
        if code_challenge_method != "S256" or not _CHALLENGE_PATTERN.fullmatch(code_challenge):
            raise OAuthError("invalid_request", "PKCE S256 is required.")
        # offline_access requests a refresh token; it is not an application data
        # permission and must not appear in the CDL connection's granted scopes.
        scopes = [scope for scope in requested_scopes if scope in APPLICATION_SCOPES]
        return client, scopes

    def issue_code(
        self,
        *,
        user_id: str,
        client_id: str,
        redirect_uri: str,
        scopes: list[str],
        code_challenge: str,
    ) -> str:
        code = secrets.token_urlsafe(48)
        self._repository.create_code(
            code,
            {
                "client_id": client_id,
                "user_id": user_id,
                "redirect_uri": redirect_uri,
                "scopes": scopes,
                "code_challenge": code_challenge,
                "expires_at": datetime.now(UTC) + timedelta(seconds=AUTHORIZATION_CODE_SECONDS),
                "consumed_at": None,
            },
        )
        return code

    def exchange_code(
        self,
        *,
        client_id: str,
        code: str,
        redirect_uri: str,
        code_verifier: str,
    ) -> dict[str, object]:
        if not _VERIFIER_PATTERN.fullmatch(code_verifier):
            raise OAuthError("invalid_grant", "The PKCE verifier is invalid.")
        client = self._repository.get_client(client_id)
        if not client or redirect_uri not in client["redirect_uris"]:
            raise OAuthError("invalid_grant", "The authorization grant is invalid.")
        actual = (
            base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest())
            .rstrip(b"=")
            .decode()
        )
        row = self._repository.consume_code(code, client_id, redirect_uri, actual)
        if not row:
            raise OAuthError(
                "invalid_grant", "The authorization code is invalid or the verifier does not match."
            )
        return self._new_connection_and_tokens(row, client)

    def refresh(self, *, client_id: str, refresh_token: str) -> dict[str, object]:
        if not refresh_token or len(refresh_token) > 512:
            raise OAuthError("invalid_grant", "The refresh token is invalid.")
        client = self._repository.get_client(client_id)
        if not client:
            raise OAuthError("invalid_client", "The client is not registered.")
        new_refresh = secrets.token_urlsafe(48)
        expires = datetime.now(UTC) + timedelta(days=REFRESH_TOKEN_DAYS)
        connection = self._repository.rotate_refresh(
            token_hash(refresh_token), token_hash(new_refresh), expires, client_id
        )
        if not connection:
            raise OAuthError("invalid_grant", "The refresh token is invalid or revoked.")
        return self._token_response(connection, client["client_name"], new_refresh)

    def _new_connection_and_tokens(
        self, code: dict[str, object], client: dict[str, object]
    ) -> dict[str, object]:
        now = datetime.now(UTC)
        refresh = secrets.token_urlsafe(48)
        connection = self._repository.create_connection(
            {
                "id": str(uuid4()),
                "user_id": code["user_id"],
                "client_id": code["client_id"],
                "scopes": code["scopes"],
                "created_at": now,
                "last_used_at": now,
                "revoked_at": None,
            },
            token_hash(refresh),
            now + timedelta(days=REFRESH_TOKEN_DAYS),
        )
        return self._token_response(connection, client["client_name"], refresh)

    def _token_response(
        self, connection: dict[str, object], client_name: str, refresh: str
    ) -> dict[str, object]:
        now = datetime.now(UTC)
        access = jwt.encode(
            {
                "iss": self._issuer,
                "aud": "cdl-mcp",
                "sub": connection["user_id"],
                "client_id": connection["client_id"],
                "connection_id": connection["id"],
                "scope": " ".join(connection["scopes"]),
                "jti": uuid4().hex,
                "iat": now,
                "exp": now + timedelta(seconds=ACCESS_TOKEN_SECONDS),
            },
            self._secret,
            algorithm="HS256",
        )
        return {
            "access_token": access,
            "token_type": "Bearer",
            "expires_in": ACCESS_TOKEN_SECONDS,
            "refresh_token": refresh,
            "scope": " ".join(connection["scopes"]),
        }

    def validate_access_token(
        self, access_token: str, required_scopes: set[str] | None = None
    ) -> dict[str, object]:
        try:
            claims = jwt.decode(
                access_token,
                self._secret,
                algorithms=["HS256"],
                audience="cdl-mcp",
                issuer=self._issuer,
            )
        except jwt.PyJWTError as exc:
            raise OAuthError("invalid_token", "The access token is expired or invalid.") from exc
        connection = self._repository.get_connection(str(claims.get("connection_id", "")))
        if (
            not connection
            or connection["revoked_at"] is not None
            or connection["user_id"] != claims.get("sub")
            or connection["client_id"] != claims.get("client_id")
        ):
            raise OAuthError("invalid_token", "The connection has been revoked.")
        scopes = set(claims.get("scope", "").split())
        if not scopes.issubset(set(connection["scopes"])):
            raise OAuthError("invalid_token", "The token exceeds the granted connection scopes.")
        if required_scopes and not required_scopes.issubset(scopes):
            raise OAuthError("insufficient_scope", "The token does not grant the required scope.")
        return claims

    def revoke_token(self, token: str, client_id: str = "") -> None:
        # RFC 7009 intentionally returns success for unknown tokens. Known refresh
        # tokens are revoked by replay rotation or the owner-facing connection route.
        try:
            claims = jwt.decode(
                token,
                self._secret,
                algorithms=["HS256"],
                audience="cdl-mcp",
                issuer=self._issuer,
                options={"verify_exp": False},
            )
        except jwt.PyJWTError:
            self._repository.revoke_refresh(token_hash(token), client_id)
            return
        connection_id = claims.get("connection_id")
        if connection_id:
            connection = self._repository.get_connection(str(connection_id))
            if connection and connection["client_id"] == client_id:
                self._repository.revoke_connection(str(connection_id), str(connection["user_id"]))

    def list_connections(self, user_id: str) -> list[dict[str, object]]:
        return self._repository.list_connections(user_id)

    def revoke_connection(self, connection_id: str, user_id: str) -> bool:
        return self._repository.revoke_connection(connection_id, user_id)
