from datetime import date

from cdl_api.contracts import RuleCategory, RuleSection, RuleVersion


def test_rule_section_contract_has_stable_identifier_and_version() -> None:
    version = RuleVersion(version="2026.05", effective_date=date(2026, 5, 22))
    section = RuleSection(
        id="squad-size",
        title="Squad Size",
        category=RuleCategory.SQUADS,
        summary="Squads stay inside roster limits.",
        body=["Roster limits are checked before submission."],
        anchors=["squad-size"],
        version=version,
    )

    assert section.id == "squad-size"
    assert section.category == RuleCategory.SQUADS
    assert section.version.version == "2026.05"
