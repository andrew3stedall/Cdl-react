"""Application settings."""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

RepositoryMode = Literal["memory", "postgres"]
DEFAULT_DEVELOPMENT_LOGIN_SECRET = "demo-login-secret"


class Settings(BaseSettings):
    app_name: str = "Castle Draft League API"
    api_prefix: str = "/api"
    environment: str = "development"
    session_cookie_name: str = "cdl_session"
    session_cookie_secure: bool = False
    development_login_secret: str = DEFAULT_DEVELOPMENT_LOGIN_SECRET
    google_client_id: str = ""
    google_allowed_emails: str = ""
    database_url: str = ""
    database_pool_size: int = Field(default=5, ge=1)
    database_max_overflow: int = Field(default=5, ge=0)
    database_pool_recycle_seconds: int = Field(default=300, ge=30)
    repository_mode: RepositoryMode = "memory"
    frontend_dist_dir: Path | None = None
    fpl_api_base_url: str = "https://fantasy.premierleague.com/api"
    fpl_api_timeout_seconds: float = Field(default=20.0, gt=0, le=60)

    model_config = SettingsConfigDict(env_prefix="CDL_", env_file=".env")

    @property
    def google_allowed_email_set(self) -> set[str]:
        return {
            email.strip().lower()
            for email in self.google_allowed_emails.split(",")
            if email.strip()
        }

    @property
    def google_sign_in_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_allowed_email_set)


def get_settings() -> Settings:
    return Settings()