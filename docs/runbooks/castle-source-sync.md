# Rerun the Castle source sync

Use GitHub → `andrew3stedall/Cdl-react` → Actions → **Castle Sync Staging** →
**Run workflow**, branch **main**. This works from a phone after the implementing
PR is merged. Runs are manual, with no schedule.

## Prerequisites

The existing `castle-personal-read-credential` secret in `cdl-react-staging-ast`
belongs to the same personal Castle account used with Google. No second account is
needed. Reuse staging WIF variables and environment protections.

The Actions identity also needs Secret Manager access to `cdl-database-url` and
Cloud SQL Client access to the staging instance. **This PR does not establish that
access.** Terraform declares those database grants for runtime/migration identities,
not `github-deploy`; any manual grants are unverified. If absent, review narrowly
scoped permission changes before an operator applies them. The workflow never
grants itself permissions or uses a backend source credential to bypass row access.

The database secret must describe `cdl_app` / `cdl_react` over
`/cloudsql/cdl-react-staging-ast:australia-southeast1:cdl-react-staging-postgres`.
The verified Cloud SQL Auth Proxy connects to this exact staging instance.
Other branches, repositories and production destinations are rejected.

## First archive load

1. Run `operation=plan`, `projection=archive`. Keep other defaults. `source_league`
   may be empty only when one league is available.
2. Review the summary or `castle-sync-report.json`: source counts/changes, mapping
   conflicts, native conflicts and `gaps`. Archive mode preserves unsupported
   records without changing native app rows.
3. Copy `plan_digest`. Run again with identical projection/mapping/adoption inputs,
   `operation=apply`, `expected_plan=<digest>` and
   `confirmation=IMPORT CASTLE STAGING`.
4. Confirm `applied=true`. If the digest is stale, no partial changes are written;
   run a fresh plan rather than bypassing the mismatch.

Each run fetches fresh personal-account source data. No FPL functions are called;
older encrypted exports containing FPL are also excluded by the import adapter.

## Compatible native app records

After archiving, run a new plan with `projection=native`. This has a different
digest. Review the [schema mapping](../features/active/castle-source-sync.md).

| Optional JSON input | Example | Meaning |
|---|---|---|
| `team_aliases` | `{"Source Name":"existing-target-team-id"}` | Reviewed renamed-team match. |
| `player_ids` | `{"123":"fpl-456"}` | Confirm identity against an existing cached target player. |
| `trade_gameweeks` | `{"source-trade-id":7}` | Independently known gameweek; never infer a missing value. |

Source values are in the encrypted export; target IDs come from existing app/repo
data. Do not publish records or credentials in issues/logs. Reports expose counts
and gap codes rather than identity values.

`adopt_existing=true` permits first replacement of differing compatible native
rows, with projected before-images saved. Review that choice before planning. It
cannot override edits after a prior sync, frozen scoring evidence or mapping
conflicts. There is no force-overwrite input.

`allow_gaps=true` acknowledges that unsupported records remain archived. Current
trade visibility/schema gaps mean native apply requires this acknowledgment. It
does not make missing data complete or override conflicts. Set it only after
review; skip native loading if the gaps are unacceptable. Apply using the reviewed
native digest and identical inputs.

Compatible fixtures, aggregate scores, lineups and trades can use existing
screens. Archived draw history, all-time records and other unsupported entities
need a future reader or schema adaptation before frontend presentation. This PR
does not claim a complete native history migration.

## Future repeats and recovery

Repeat plan → review → apply using the same workflow and consistent mappings.
Archive mode retains all accessible non-FPL information; native projection remains
optional. Unchanged payloads create no duplicate source versions or audit batches;
changed files retain prior versions. Missing source rows do not delete targets.
A fresh plan is required after any successful apply.

Direct database writes do not dispatch browser cache invalidation. Reload the app
and use its existing refresh path after native apply.

Only the scalar report and encrypted source package are uploaded, for three days.
Plaintext is removed even on failure. See [encryption instructions](../wiki/castle-temporary-export.md).
Database errors are sanitized to avoid leaking connection strings/SQL parameters.
If a run fails, check its authentication/export/proxy stage, database permissions,
existing tables and latest plan. Failed transactions roll back.

There is no destructive automatic rollback. Use existing staging backup practices
before native loading. For reviewed corrections, inspect `import_batches` audits,
source versions and `castle_target_backup` before-images in
`import_source_payloads`, and projection digests in `import_source_mappings`.
Prepare a scoped correction PR; do not wipe import tables or replay transfers.

Source RLS still limits trade/private planning coverage. Missing snapshots and
uncertain ownership timelines remain gaps. Sequential source changes can require
another plan. No backend/source secrets expand personal read access.
