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
    attack_direction: str = "up"
    fdr_scale: str = "RdYlGn"
    fdr_scale_reversed: bool = True
    fdr_display_mode: str = "font"
    light_theme_colour: str = "#0F766E"
    dark_theme_colour: str = "#2DD4BF"
    fdr_custom_min: str = "#2166AC"
    fdr_custom_second: str = "#8CAFD2"
    fdr_custom_mid: str = "#F7F7F7"
    fdr_custom_fourth: str = "#D58891"
    fdr_custom_max: str = "#B2182B"
