# Rules delivery — #509

Implemented an API-backed Rules workspace with loading, failed-read retry, controlled search/category filters, empty results, clear filters, and stable hash links. Rules are accessible from the account menu on mobile while keeping four primary bottom-navigation items.

The backend now serves readable sections from the accepted decision log rather than validation/developer placeholders. `lineup-validation`, `captaincy`, and `chip-usage` resolve; legacy `chip-use` remains an alias. Rule text deliberately leaves unresolved bonus criteria, vice-captain fallback, and second-level knockout ties to their tracked decisions, rather than inventing policy. This release does not claim a league-config authoring interface.

Validation: Rules frontend regression and helper suite passed (3 tests). Backend validation will run after shared test dependencies are restored and in GitHub CI.

Formation ranges are settled in `docs/product/combined-squad-team-selection-working-notes.md` and `docs/product/pages/squad.md`. The checkpoint six-item list is corrected to match these authoritative ranges (#498).
