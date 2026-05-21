"""Rules knowledge base service."""

from datetime import date

from cdl_api.contracts.rules import (
    RuleCategory,
    RuleSection,
    RulesIndexResponse,
    RuleVersion,
)


class RulesService:
    def __init__(self) -> None:
        version = RuleVersion(version="2026.05", effective_date=date(2026, 5, 22))
        self._rules = [
            RuleSection(
                id="draft-order",
                title="Draft Order",
                category=RuleCategory.DRAFT,
                summary="Managers draft players in a fixed order.",
                body=[
                    "Draft order is determined before the season starts.",
                    "Each completed round reverses the next round order.",
                ],
                tags=["draft", "snake"],
                anchors=["draft-order"],
                related_rule_ids=["squad-size"],
                version=version,
            ),
            RuleSection(
                id="squad-size",
                title="Squad Size",
                category=RuleCategory.SQUADS,
                summary="Squads must remain within roster limits.",
                body=[
                    "Each squad must contain the approved roster count.",
                    "Invalid squads fail validation before submission.",
                ],
                tags=["squad", "validation"],
                anchors=["squad-size"],
                related_rule_ids=["draft-order"],
                version=version,
            ),
            RuleSection(
                id="trade-window",
                title="Trade Window",
                category=RuleCategory.TRADES,
                summary="Trades are limited to active trade windows.",
                body=[
                    "Trades lock before the weekly deadline.",
                    "Commissioners may reverse invalid trades.",
                ],
                tags=["trades", "commissioner"],
                anchors=["trade-window"],
                related_rule_ids=[],
                version=version,
            ),
        ]
        self._version = version

    def list_rules(self, category: RuleCategory | None = None) -> RulesIndexResponse:
        sections = self._rules
        if category is not None:
            sections = [rule for rule in sections if rule.category == category]

        return RulesIndexResponse(
            version=self._version,
            categories=list(RuleCategory),
            sections=sections,
        )

    def get_rule(self, rule_id: str) -> RuleSection | None:
        return next((rule for rule in self._rules if rule.id == rule_id), None)

    def search_rules(
        self,
        query: str,
        category: RuleCategory | None = None,
    ) -> RulesIndexResponse:
        normalized = query.lower().strip()
        sections = self._rules

        if category is not None:
            sections = [rule for rule in sections if rule.category == category]

        if normalized:
            sections = [
                rule
                for rule in sections
                if normalized in rule.title.lower()
                or normalized in rule.summary.lower()
                or any(normalized in paragraph.lower() for paragraph in rule.body)
            ]

        return RulesIndexResponse(
            version=self._version,
            categories=list(RuleCategory),
            sections=sections,
        )
