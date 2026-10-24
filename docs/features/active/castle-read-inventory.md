# Castle source read inventory

Status: Local and GitHub Actions/GCP collectors implemented; credential bootstrap
and authenticated live validation pending.

Purpose: Determine which documented source fields and records Andrew's personal
Castle identity can read for a later CDL React synchronization adapter.

Scope: Interactive local Google login through the unchanged source app; user-scoped
REST reads and four FPL read functions; counts/status/field inventory without secrets
or raw row values. See [operator instructions](../../wiki/castle-data-inventory.md).

Acceptance: No source writes or service-role credentials; league scope comes from
membership; private planning reads remain self-scoped; report distinguishes empty
or filtered responses from failures; no credentials or session state persisted.

Dependencies: Node 22+, installed Chrome, frontend Playwright dependency and source
endpoint reachability. Google may reject automated Chrome; a successful local login
is not yet verified. CI tests cover mock transport only.

The manual Actions runner reads a Castle-only personal email/password credential
from a dedicated GCP staging secret using the existing WIF identity. Adding the
password, provisioning the secret and any secret-level IAM grant require setup;
none has been performed. No Google password is collected. Nine Node tests pass.

Next: Complete the phone-compatible credential setup, run the workflow, compare returned fields with frontend use, identify
missing datasets and map import identities/pagination. Durable personal session
rotation and actual synchronization remain follow-up work after access is
demonstrated. No application deployment is needed for this tool.
