"""Application settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Castle Draft League API"
    api_prefix: str = "/api"
    environment: str = "development"

    model_config = SettingsConfigDict(env_prefix="CDL_", env_file=".env")


def get_settings() -> Settings:
    return Settings()
