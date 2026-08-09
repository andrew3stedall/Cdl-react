"""Theme contract models."""

from pydantic import BaseModel, Field


class ThemePreset(BaseModel):
    name: str
    label: str
    description: str = ""
    is_default: bool = False
    tokens: dict[str, object] = Field(default_factory=dict)


class UserPreferences(BaseModel):
    theme_preset: str = "teal-light"
