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


class PlayerColourPaletteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    family: Literal["position", "metric"]
    colours: list[str] = Field(min_length=4, max_length=5)


class PlayerColourPalette(PlayerColourPaletteCreate):
    id: str


class UserPreferences(BaseModel):
    theme_preset: str = "teal-light"
    attack_direction: str = "up"
    fdr_scale: str = "RdYlGn"
    fdr_scale_reversed: bool = True
    fdr_display_mode: str = "font"
    position_colour_scale: str = "Classic"
    position_colour_mode: str = "name-font"
    position_custom_gkp: str = "#7C3AED"
    position_custom_def: str = "#2563EB"
    position_custom_mid: str = "#059669"
    position_custom_fwd: str = "#EA580C"
    metric_colour_scale: str = "Blue"
    metric_colour_scale_reversed: bool = False
    metric_custom_1: str = "#2563EB"
    metric_custom_2: str = "#0EA5A4"
    metric_custom_3: str = "#A3C635"
    metric_custom_4: str = "#F59E0B"
    metric_custom_5: str = "#DC2626"
    light_theme_colour: str = "#0F766E"
    dark_theme_colour: str = "#2DD4BF"
    fdr_custom_min: str = "#2166AC"
    fdr_custom_second: str = "#8CAFD2"
    fdr_custom_mid: str = "#F7F7F7"
    fdr_custom_fourth: str = "#D58891"
    fdr_custom_max: str = "#B2182B"
