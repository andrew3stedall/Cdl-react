# League Configuration and Rule Versioning

## Purpose

Define UI-editable league configuration with versioned rule snapshots so historical decisions and scoring remain explainable.

## Status

Proposed / accepted discovery.

## Business Rules

- Commissioners configure league rules through UI forms, not raw JSON/YAML.
- Database `config_json` stores the authoritative versioned rules.
- YAML may be used for templates/import/export, not runtime truth.
- Rule changes are versioned.
- Dangerous rules are restricted after draft or season start.
- Historical actions should reference the rule version used.

## Target Architecture

```text
league_rule_templates
league_season_rule_versions
```

Example config domains:

```text
league
season
draft
free_agency
transfers
loans
lineups
scoring
chips
knockout
```

## API Requirements

- Get active rule version.
- Create draft rule version.
- Validate rule config.
- Activate rule version.
- Compare rule versions.
- List editability constraints by season state.

## React Requirements

- Commissioner configuration UI with forms.
- Rule version history.
- Warnings when a change affects future scoring or workflows.
- Prevent raw config editing for normal users.

## Data Access Requirements

- Store `config_json` and validation metadata.
- Reference rule versions from drafts, free agency draws, transfers, score snapshots, and relevant approvals.

## Acceptance Criteria

- Rules can be changed safely before locked phases.
- Past results remain tied to the rule version that produced them.
- Config validation prevents impossible rule combinations.
