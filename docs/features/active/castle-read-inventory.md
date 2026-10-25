# Castle source read inventory

Status: personal credential bootstrap and authenticated Actions export validated.
Live source run `40143323798` succeeded; database loading remains separate.

Purpose: Determine which documented source fields and records Andrew's personal
Castle identity can read for a later CDL React synchronization adapter.

Scope: Interactive local Google login through the unchanged source app; user-scoped
REST reads and optional FPL read functions; counts/status/field inventory without secrets
or raw row values. See [operator instructions](../../wiki/castle-data-inventory.md).

Acceptance: No source writes or service-role credentials; league scope comes from
membership; private planning reads remain self-scoped; report distinguishes empty
or filtered responses from failures; no credentials or session state persisted.

Dependencies: Node 22+, installed Chrome, frontend Playwright dependency and source
endpoint reachability. Google may reject automated Chrome; a successful local login
is not yet verified. CI tests cover mock transport only.

The manual Actions runner reads a Castle-only personal email/password credential
from a dedicated GCP staging secret using the existing WIF identity. Adding the
password and secret-level access were set up for the same personal account.
No Google password is collected. Collector regression tests cover this boundary.

Next: Review the proposed [source sync](castle-source-sync.md), identity mappings,
schema gaps and required staging database access. No app deployment is needed for
the collector; this inventory does not imply a completed database import.

## Temporary export extension

User approved exporting all established personal-account reads into temporary files.
The Castle Temporary Data Export workflow paginates source tables, derives historical
draw outcomes. FPL exports are now excluded by default. Data is encrypted
before three-day artifact retention in this public repo; credentials never enter
export files. See [export operations](../../wiki/castle-temporary-export.md).
Application mapping and database import use the separate manual sync workflow.
