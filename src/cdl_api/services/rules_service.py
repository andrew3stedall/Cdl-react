"""Rules knowledge base service."""

from datetime import date

from cdl_api.contracts.rules_models import (
    RuleCategory,
    RuleSection,
    RulesIndexResponse,
    RuleVersion,
)


class RulesService:
    def __init__(self) -> None:
        self._version = RuleVersion(version="2026.05", effective_date=date(2026, 5, 22))
        self._sections = [
            RuleSection(
                id="draft-order",
                title="Draft Order",
                category=RuleCategory.DRAFT,
                summary="Managers draft players in a fixed order before the season starts.",
                body=[
                    "Draft order is confirmed before the league draft begins.",
                    "Draft decisions define the first source of squad ownership for later validations.",
                ],
                tags=["draft", "ownership"],
                anchors=["draft-order"],
                related_rule_ids=["squad-size"],
                version=self._version,
            ),
            RuleSection(
                id="squad-size",
                title="Squad Size",
                category=RuleCategory.SQUADS,
                summary="Squads must remain within approved roster limits.",
                body=[
                    "Squad submissions must satisfy roster-size constraints before they are accepted.",
                    "Validation errors should link to this rule when squad limits are breached.",
                ],
                tags=["squad", "validation"],
                anchors=["squad-size"],
                related_rule_ids=["draft-order", "transfer-deadline"],
                version=self._version,
            ),
            RuleSection(
                id="transfer-deadline",
                title="Transfer Deadline",
                category=RuleCategory.TRANSFERS,
                summary="Transfers must be submitted before the active gameweek deadline.",
                body=[
                    "Transfer submissions lock at the configured weekly deadline.",
                    "Late transfer attempts must be rejected with a stable rule reference.",
                ],
                tags=["transfers", "deadline"],
                anchors=["transfer-deadline"],
                related_rule_ids=["squad-size"],
                version=self._version,
            ),
            RuleSection(
                id="trade-window",
                title="Trade Window",
                category=RuleCategory.TRADES,
                summary="Trades are only valid during configured trade windows.",
                body=[
                    "Trade proposals can only be accepted while the trade window is open.",
                    "Commissioners may review trades that violate league constraints.",
                ],
                tags=["trades", "commissioner"],
                anchors=["trade-window"],
                related_rule_ids=["commissioner-decisions"],
                version=self._version,
            ),
            RuleSection(
                id="matchday-lock",
                title="Matchday Lock",
                category=RuleCategory.MATCHDAY,
                summary="Line-ups lock once matchday processing starts.",
                body=[
                    "Managers must submit matchday selections before lock.",
                    "Locked selections remain immutable except through approved commissioner workflows.",
                ],
                tags=["matchday", "lineup"],
                anchors=["matchday-lock"],
                related_rule_ids=["commissioner-decisions"],
                version=self._version,
            ),
            RuleSection(
                id="chip-use",
                title="Chip Use",
                category=RuleCategory.CHIPS,
                summary="Chips can be used only when available and valid for the gameweek.",
                body=[
                    "A chip cannot be reused after it has been consumed.",
                    "Chip validation must reference this section when an unavailable chip is selected.",
                ],
                tags=["chips", "team-selection"],
                anchors=["chip-use"],
                related_rule_ids=["matchday-lock"],
                version=self._version,
            ),
            RuleSection(
                id="league-table",
                title="League Table",
                category=RuleCategory.LEAGUE,
                summary="League standings are derived from approved scoring outcomes.",
                body=[
                    "League table calculations must use official scoring and match results.",
                    "Manual table changes require an auditable commissioner decision.",
                ],
                tags=["league", "standings"],
                anchors=["league-table"],
                related_rule_ids=["commissioner-decisions"],
                version=self._version,
            ),
            RuleSection(
                id="playoff-qualification",
                title="Playoff Qualification",
                category=RuleCategory.PLAYOFFS,
                summary="Playoff eligibility follows the published league qualification rules.",
                body=[
                    "Playoff qualification is determined from final league standings.",
                    "Tie-break handling must be documented before automated playoff generation expands.",
                ],
                tags=["playoffs", "qualification"],
                anchors=["playoff-qualification"],
                related_rule_ids=["league-table"],
                version=self._version,
            ),
            RuleSection(
                id="commissioner-decisions",
                title="Commissioner Decisions",
                category=RuleCategory.COMMISSIONER,
                summary="Commissioner overrides must be explicit, auditable, and linked to rules.",
                body=[
                    "Commissioner decisions can resolve exceptional league cases.",
                    "Every override should record the affected rule and decision rationale.",
                ],
                tags=["commissioner", "audit"],
                anchors=["commissioner-decisions"],
                related_rule_ids=["trade-window", "matchday-lock"],
                version=self._version,
            ),
        ]

    def list_rules(self, category: RuleCategory | None = None) -> RulesIndexResponse:
        sections = self._filter_by_category(self._sections, category)
        return self._response(sections)

    def get_rule(self, rule_id: str) -> RuleSection | None:
        return next((section for section in self._sections if section.id == rule_id), None)

    def search_rules(
        self,
        query: str,
        category: RuleCategory | None = None,
    ) -> RulesIndexResponse:
        normalized_query = query.casefold().strip()
        sections = self._filter_by_category(self._sections, category)
        if not normalized_query:
            return self._response(sections)

        matches = [
            section
            for section in sections
            if normalized_query in section.title.casefold()
            or normalized_query in section.summary.casefold()
            or any(normalized_query in tag.casefold() for tag in section.tags)
            or any(normalized_query in paragraph.casefold() for paragraph in section.body)
        ]
        return self._response(matches)

    def _filter_by_category(
        self,
        sections: list[RuleSection],
        category: RuleCategory | None,
    ) -> list[RuleSection]:
        if category is None:
            return sections
        return [section for section in sections if section.category == category]

    def _response(self, sections: list[RuleSection]) -> RulesIndexResponse:
        return RulesIndexResponse(
            version=self._version,
            categories=list(RuleCategory),
            sections=sections,
        )
