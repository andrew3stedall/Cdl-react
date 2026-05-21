"""Session contract models."""

from datetime import datetime

from pydantic import BaseModel, Field


class SessionUser(BaseModel):
    id: str
    email: str
    display_name: str
    roles: list[str] = Field(default_factory=list)


class SessionState(BaseModel):
    is_authenticated: bool
    user: SessionUser | None = None
    expires_at: datetime | None = None
