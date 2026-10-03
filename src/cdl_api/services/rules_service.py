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
        self._version = RuleVersion(
            version="2026.10",
            effective_date=date(2026, 10, 3),
            source="docs/architecture/decision-log.md",
        )
        self._sections = [
            self._section(
                "draft-order",
                "Draft Order",
                RuleCategory.DRAFT,
                "Draft order and picking mode are confirmed before the draft starts.",
                [
                    "Draft modes are random repeating order, snake order, or a "
                    "commissioner-specified order.",
                    "Each selected player joins the picking manager’s active squad immediately.",
                    "A configured pick clock can auto-pick the highest-cost available FPL player.",
                ],
                ["draft", "ownership"],
                ["squad-size"],
            ),
            self._section(
                "squad-size",
                "Squad Size",
                RuleCategory.SQUADS,
                "A complete squad contains 20 players with exclusive ownership within its season.",
                [
                    "Squads require 2–3 goalkeepers, 4–10 defenders, 5–10 midfielders and 2–4 "
                    "forwards.",
                    "Player movement is validated against the receiving and departing teams’ "
                    "own rosters.",
                ],
                ["squad", "validation"],
                ["draft-order", "transfer-deadline"],
            ),
            self._section(
                "transfer-deadline",
                "Transfer Deadline",
                RuleCategory.TRANSFERS,
                "Free-agency draw rights expire at the relevant FPL gameweek deadline.",
                [
                    "A manager submits private ranked player preferences for an open draw.",
                    "Awards follow the confirmed draw order; each manager receives their first "
                    "available preference.",
                    "An award is added if there is space. A full squad must release a player "
                    "before the award deadline.",
                ],
                ["transfers", "deadline"],
                ["squad-size"],
            ),
            self._section(
                "trade-window",
                "Trade Window",
                RuleCategory.TRADES,
                "A trade needs both managers’ agreement and an eligible approver.",
                [
                    "Agreement alone does not transfer ownership. Commissioner approval "
                    "executes the agreed trade.",
                    "A commissioner’s own trade requires vice-commissioner approval; no "
                    "manager may approve their own trade.",
                    "Execution updates both squads atomically and removes departing players "
                    "from future unlocked lineups.",
                ],
                ["trades", "commissioner"],
                ["commissioner-decisions"],
            ),
            self._section(
                "matchday-lock",
                "Matchday Lock",
                RuleCategory.MATCHDAY,
                "Selections and chips lock at the FPL gameweek deadline.",
                [
                    "After the deadline, managers edit their next unlocked gameweek selection.",
                    "An unlocked selection rolls forward from the previous saved selection and "
                    "current squad ownership.",
                    "Departing players are removed from future unlocked selections; completed "
                    "scoring snapshots stay frozen.",
                ],
                ["matchday", "lineup"],
                ["commissioner-decisions"],
            ),
            self._section(
                "chip-usage",
                "Chip Usage",
                RuleCategory.CHIPS,
                "One available chip may be used per team per gameweek.",
                [
                    "Triple Captain gives the captain a 3× multiplier. Dual Captain gives "
                    "captain and vice-captain 2× each.",
                    "Auto Captain gives one highest-scoring player in the scoring lineup the "
                    "captain multiplier.",
                    "Bench Boost includes bench points. Best XI selects the best eleven from "
                    "starters and bench, ignoring positions. Reserves are excluded from both.",
                    "Chips lock at the deadline and cannot be reused after consumption.",
                ],
                ["chips", "team-selection"],
                ["matchday-lock"],
            ),
            self._section(
                "lineup-validation",
                "Lineup Selection",
                RuleCategory.MATCHDAY,
                "A complete selection has eleven starters, five substitutes and four reserves.",
                [
                    "All selected players must belong to the manager’s squad for the gameweek.",
                    "Starting XI limits: 1 goalkeeper, 3–5 defenders, 2–5 midfielders, "
                    "and 1–3 forwards.",
                    "The bench contains one goalkeeper and four outfield players in "
                    "substitution order.",
                    "Players with zero minutes can be substituted in bench order while "
                    "preserving a valid formation; a player who played keeps their score, "
                    "including negative points.",
                ],
                ["lineup", "selection", "bench", "reserves"],
                ["matchday-lock", "captaincy", "chip-usage"],
            ),
            self._section(
                "captaincy",
                "Captaincy",
                RuleCategory.MATCHDAY,
                "Captain and vice-captain are distinct starting players.",
                [
                    "Bench and reserve players cannot be selected as captain or vice-captain.",
                    "The selected captain receives the normal captain multiplier unless the "
                    "active chip changes it.",
                ],
                ["captain", "vice-captain", "multiplier"],
                ["lineup-validation", "chip-usage"],
            ),
            self._section(
                "league-table",
                "League Table",
                RuleCategory.LEAGUE,
                "Head-to-head results award three points for a win and one for a draw.",
                [
                    "Live and provisional scores may change as FPL data updates. Official "
                    "results use a frozen final snapshot.",
                    "Bonus-point criteria require an approved league rule before activation; "
                    "they are not inferred from FPL entry rules.",
                ],
                ["league", "standings"],
                ["commissioner-decisions"],
            ),
            self._section(
                "playoff-qualification",
                "Playoff Qualification",
                RuleCategory.PLAYOFFS,
                "Knockouts follow final regular-season standings and the configured schedule.",
                [
                    "The accepted default schedule uses gameweeks 36–38: top-four two-leg "
                    "semifinals, then a final and third-place match.",
                    "The first tiebreaker is goals scored by scoring-lineup players, "
                    "aggregated across both legs for a two-leg tie.",
                    "A tie still unresolved after that tiebreaker requires a commissioner "
                    "decision under the approved league rules.",
                ],
                ["playoffs", "qualification"],
                ["league-table"],
            ),
            self._section(
                "commissioner-decisions",
                "Commissioner Decisions",
                RuleCategory.COMMISSIONER,
                "Approvals and corrections require an eligible actor and an audit record.",
                [
                    "Trade approval follows both managers’ agreement and cannot be performed "
                    "by a participant.",
                    "Corrections record the actor, reason, affected rule and previous outcome. "
                    "Historical corrections append an audit record.",
                ],
                ["commissioner", "audit"],
                ["trade-window", "matchday-lock"],
            ),
        ]

    def list_rules(self, category: RuleCategory | None = None) -> RulesIndexResponse:
        sections = self._filter_by_category(self._sections, category)
        return self._response(sections)

    def get_rule(self, rule_id: str) -> RuleSection | None:
        return next(
            (
                section
                for section in self._sections
                if section.id == rule_id or rule_id in section.anchors
            ),
            None,
        )

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
            anchors=[rule_id, "chip-use"] if rule_id == "chip-usage" else [rule_id],
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
