"""Theme and FDR colour preference contract models."""

from typing import Literal

from pydantic import BaseModel, Field


class ThemePreset(BaseModel):
    name: str
    label: str
    description: str = ""
    is_default: bool = False
    tokens: dict[str, object] = Field(default_factory=dict)


class FdrCustomPaletteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    mode: Literal["anchors", "all"] = "anchors"
    min: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    second: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    mid: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    fourth: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    max: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


class FdrCustomPalette(FdrCustomPaletteCreate):
    id: str


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
