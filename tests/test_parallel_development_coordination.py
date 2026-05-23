from pathlib import Path

COORDINATION_PATH = Path("docs/features/active/parallel-development-coordination.md")
WIKI_PATH = Path("docs/wiki/parallel-development-coordination.md")
FEATURES_README_PATH = Path("docs/features/README.md")
AGENTS_PATH = Path("AGENTS.md")


def read_coordination() -> str:
    return COORDINATION_PATH.read_text(encoding="utf-8")


def read_wiki() -> str:
    return WIKI_PATH.read_text(encoding="utf-8")


def test_every_agent_workflow_has_issue_and_feature_document_mapping() -> None:
    content = read_coordination()

    expected_mappings = {
        "Agent 01 - Authentication": ("#2", "authentication-and-session-management.md"),
        "Agent 02 - Application Shell": (
            "#3",
            "application-shell-navigation-and-presets.md",
        ),
        "Agent 03 - Backend Platform": ("#4", "backend-api-data-platform.md"),
        "Agent 04 - Squad Management": (
            "#5",
            "squad-management-scouting-and-transfers.md",
        ),
        "Agent 05 - Team Selection": ("#6", "team-selection-and-chip-management.md"),
        "Agent 06 - League Fixtures": ("#7", "league-fixtures-and-table.md"),
        "Agent 07 - Rules": ("#8", "rules-knowledge-base.md"),
        "Agent 08 - Dashboard": ("#9", "analytics-dashboard.md"),
        "Agent 09 - FDR": ("#10", "fixture-difficulty-ratings.md"),
        "Agent 10 - Migration Index": ("#11", "legacy-migration-feature-index.md"),
    }

    for workflow, (issue, feature_document) in expected_mappings.items():
        assert workflow in content
        assert issue in content
        assert f"docs/features/active/{feature_document}" in content


def test_shared_contract_register_tracks_canonical_owners() -> None:
    content = read_coordination()

    for contract_area in [
        "Session model and protected-route behaviour",
        "API error shape and Pydantic response conventions",
        "Route names and navigation labels",
        "User preference and theme preset models",
        "Shared team, player, fixture, gameweek, metric, and rating models",
        "Legacy migration mapping and missing-feature discovery",
    ]:
        assert contract_area in content

    for owner in ["Agent 01", "Agent 02", "Agent 03", "Agent 10"]:
        assert owner in content


def test_cross_feature_test_matrix_mentions_all_feature_areas() -> None:
    content = read_coordination()

    for feature in [
        "Authentication",
        "Application Shell",
        "Backend Platform",
        "Squad Management",
        "Team Selection",
        "League Fixtures",
        "Rules",
        "Dashboard",
        "FDR",
        "Migration Index",
    ]:
        assert f"| {feature} |" in content


def test_coordination_wiki_summarises_guardrails_and_release_rules() -> None:
    content = read_wiki()

    for phrase in [
        "Agent Workflow Map",
        "Shared Contract Guardrails",
        "Cross-Feature Validation",
        "Release Coordination",
        "Active feature documents remain active until a deliberate release-management pass",
    ]:
        assert phrase in content


def test_repository_operating_docs_reference_parallel_coordination_rules() -> None:
    features_readme = FEATURES_README_PATH.read_text(encoding="utf-8")
    agents = AGENTS_PATH.read_text(encoding="utf-8")

    assert "Parallel work must document dependencies" in features_readme
    assert "Parallel agent coordination" in agents
    assert "Shared API contracts, models, routes, theme tokens, and components" in agents
