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
            self._section(
                "draft-order",
                "Draft Order",
                RuleCategory.DRAFT,
                "Managers draft players in a fixed order before the season starts.",
                ["Draft order is confirmed before the draft begins."],
                ["draft", "ownership"],
                ["squad-size"],
            ),
            self._section(
                "squad-size",
                "Squad Size",
                RuleCategory.SQUADS,
                "Squads must remain within approved roster limits.",
                ["Squad submissions must satisfy roster-size constraints."],
                ["squad", "validation"],
                ["draft-order", "transfer-deadline"],
            ),
            self._section(
                "transfer-deadline",
                "Transfer Deadline",
                RuleCategory.TRANSFERS,
                "Transfers must be submitted before the active gameweek deadline.",
                ["Late transfer attempts must be rejected with a rule reference."],
                ["transfers", "deadline"],
                ["squad-size"],
            ),
            self._section(
                "trade-window",
                "Trade Window",
                RuleCategory.TRADES,
                "Trades are only valid during configured trade windows.",
                ["Trade proposals can only be accepted while the window is open."],
                ["trades", "commissioner"],
                ["commissioner-decisions"],
            ),
            self._section(
                "matchday-lock",
                "Matchday Lock",
                RuleCategory.MATCHDAY,
                "Line-ups lock once matchday processing starts.",
                ["Managers must submit matchday selections before lock."],
                ["matchday", "lineup"],
                ["commissioner-decisions"],
            ),
            self._section(
                "chip-use",
                "Chip Use",
                RuleCategory.CHIPS,
                "Chips can be used only when available and valid.",
                ["A chip cannot be reused after it has been consumed."],
                ["chips", "team-selection"],
                ["matchday-lock"],
            ),
            self._section(
                "league-table",
                "League Table",
                RuleCategory.LEAGUE,
                "League standings are derived from approved scoring outcomes.",
                ["League tables must use official scoring and match results."],
                ["league", "standings"],
                ["commissioner-decisions"],
            ),
            self._section(
                "playoff-qualification",
                "Playoff Qualification",
                RuleCategory.PLAYOFFS,
                "Playoff eligibility follows published qualification rules.",
                ["Playoff qualification is based on final league standings."],
                ["playoffs", "qualification"],
                ["league-table"],
            ),
            self._section(
                "commissioner-decisions",
                "Commissioner Decisions",
                RuleCategory.COMMISSIONER,
                "Commissioner overrides must be explicit and linked to rules.",
                ["Every override should record the rule and decision rationale."],
                ["commissioner", "audit"],
                ["trade-window", "matchday-lock"],
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

    def _section(
        self,
        rule_id: str,
        title: str,
        category: RuleCategory,
        summary: str,
        body: list[str],
        tags: list[str],
        related_rule_ids: list[str],
    ) -> RuleSection:
        return RuleSection(
            id=rule_id,
            title=title,
            category=category,
            summary=summary,
            body=body,
            tags=tags,
            anchors=[rule_id],
            related_rule_ids=related_rule_ids,
            version=self._version,
        )

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
