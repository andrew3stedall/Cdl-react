"""Application settings."""

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

RepositoryMode = Literal["memory", "postgres"]


class Settings(BaseSettings):
    app_name: str = "Castle Draft League API"
    api_prefix: str = "/api"
    environment: str = "development"
    session_cookie_name: str = "cdl_session"
    development_login_secret: str = "demo-login-secret"
    database_url: str = ""
    database_pool_size: int = Field(default=5, ge=1)
    database_max_overflow: int = Field(default=5, ge=0)
    repository_mode: RepositoryMode = "memory"

    model_config = SettingsConfigDict(env_prefix="CDL_", env_file=".env")


def get_settings() -> Settings:
    return Settings()
