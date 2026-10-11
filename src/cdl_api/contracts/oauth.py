"""Public response and request contracts for the MCP OAuth server."""

from datetime import datetime

from pydantic import BaseModel, Field

PUBLIC_CLIENT_AUTH_METHOD = "none"  # noqa: S105


class OAuthClientRegistrationRequest(BaseModel):
    client_name: str = Field(min_length=1, max_length=120)
    redirect_uris: list[str] = Field(min_length=1, max_length=10)
    grant_types: list[str] = Field(default_factory=lambda: ["authorization_code", "refresh_token"])
    response_types: list[str] = Field(default_factory=lambda: ["code"])
    token_endpoint_auth_method: str = PUBLIC_CLIENT_AUTH_METHOD


class OAuthClientRegistrationResponse(BaseModel):
    client_id: str
    client_name: str
    redirect_uris: list[str]
    grant_types: list[str]
    response_types: list[str]
    token_endpoint_auth_method: str


class OAuthConnectionResponse(BaseModel):
    id: str
    client_id: str
    client_name: str
    scopes: list[str]
    created_at: datetime
    last_used_at: datetime | None = None


class OAuthConsentRequest(BaseModel):
    client_id: str
    redirect_uri: str
    response_type: str
    scope: str
    state: str | None = None
    code_challenge: str
    code_challenge_method: str
    csrf_token: str
    decision: str
