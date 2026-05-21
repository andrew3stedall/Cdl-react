"""Rules knowledge base contract models."""

from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field


class RuleCategory(StrEnum):
    DRAFT = "draft"
    SQUADS = "squads"
    TRANSFERS = "transfers"
    TRADES = "trades"
    MATCHDAY = "matchday"
    CHIPS = "chips"
    LEAGUE = "league"
    PLAYOFFS = "playoffs"
    COMMISSIONER = "commissioner"


class RuleVersion(BaseModel):
    version: str
    effective_date: date
    status: str = "active"
    source: str = "docs/features/active/rules-knowledge-base.md"


class RuleSection(BaseModel):
    id: str
    title: str
    category: RuleCategory
    summary: str
    body: list[str]
    tags: list[str] = Field(default_factory=list)
    anchors: list[str] = Field(default_factory=list)
    related_rule_ids: list[str] = Field(default_factory=list)
    version: RuleVersion


class RulesIndexResponse(BaseModel):
    version: RuleVersion
    categories: list[RuleCategory]
    sections: list[RuleSection]
