# League Configuration and Rule Versioning

## Purpose

Define UI-editable league configuration with versioned rule snapshots so historical decisions and scoring remain explainable.

## Status

Runtime rule-version pinning for the current CDL 2026/27 season is delivered as #523 foundation. The database stores immutable version snapshots and an active-version pointer; FPL-deadline lineups and completed fixture scoring snapshots record the version used. Commissioner editing, version activation workflows, templates, and multi-season rule administration remain planned. Unresolved league rules remain explicitly unconfigured.

## Business Rules

- Commissioners configure league rules through UI forms, not raw JSON/YAML.
- Database `config_json` stores the authoritative versioned rules.
- YAML may be used for templates/import/export, not runtime truth.
- Rule changes are versioned.
- A published version is append-only; changes require a new version and an explicit active-version switch.
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
- The current runtime contract pins the version on locked lineups and finalized fixture score snapshots. Other action families remain separate follow-up work until their owning persistence contracts can reference this model.

## Acceptance Criteria

- Rules can be changed safely before locked phases.
- Past results remain tied to the rule version that produced them.
- Config validation prevents impossible rule combinations.

## Current pinned v1 contract

Version 1 snapshots the accepted, implemented defaults for squad size and position limits, starting lineup limits, captain/vice eligibility, zero-minute substitutions and formation preservation, 4-gameweek movement cooling-off, league win/draw points, and the decided chip multipliers/eligibility. Bonus-point rules (#494), captain absence and vice fallback (#499), and playoff tie handling (#496) are stored as unconfigured decisions; no values are inferred for them. The initial version is seeded only for the current 2026/27 season because other seasons are not yet runtime-selectable.
