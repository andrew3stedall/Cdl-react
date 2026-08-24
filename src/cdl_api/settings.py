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
    session_ttl_days: int = Field(default=30, ge=1, le=365)
    development_login_secret: str = DEFAULT_DEVELOPMENT_LOGIN_SECRET
    google_client_id: str = ""
    google_allowed_emails: str = ""
    apple_client_id: str = ""
    apple_team_id: str = ""
    apple_key_id: str = ""
    apple_private_key: str = ""
    apple_redirect_uri: str = ""
    apple_allowed_emails: str = ""
    passkey_rp_id: str = ""
    passkey_expected_origin: str = ""
    passkey_rp_name: str = "Castle Draft League"
    database_url: str = ""
    database_pool_size: int = Field(default=5, ge=1)
    database_max_overflow: int = Field(default=5, ge=0)
    database_pool_timeout_seconds: int = Field(default=10, ge=1)
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

    @property
    def apple_allowed_email_set(self) -> set[str]:
        return {
            email.strip().lower() for email in self.apple_allowed_emails.split(",") if email.strip()
        }

    @property
    def apple_sign_in_enabled(self) -> bool:
        return bool(
            self.apple_client_id
            and self.apple_team_id
            and self.apple_key_id
            and self.apple_private_key
            and self.apple_redirect_uri
            and self.apple_allowed_email_set
        )

    @property
    def passkey_enabled(self) -> bool:
        return bool(self.passkey_rp_id and self.passkey_expected_origin)


def get_settings() -> Settings:
    return Settings()
