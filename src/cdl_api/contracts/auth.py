"""Authentication request and response contract models."""

from pydantic import BaseModel, EmailStr, Field

from cdl_api.contracts.session import SessionState


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    session: SessionState


class GoogleAuthConfig(BaseModel):
    enabled: bool
    client_id: str | None = None


class GoogleCredentialRequest(BaseModel):
    credential: str = Field(min_length=1)


class LogoutResponse(BaseModel):
    session: SessionState
