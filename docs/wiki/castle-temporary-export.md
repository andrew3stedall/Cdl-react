# Castle temporary source export

The **Castle Temporary Data Export** Actions workflow reads the source using the
existing personal Castle credential in staging Secret Manager. It runs manually or
after trusted main changes to its exporter/workflow. No application import,
deployment, backend credential escalation, database writes or schedule is included.

The package contains every page of the previously tested table queries, ordered by
stable source keys. Counts must remain consistent across pages; drift/read failures
are recorded, never represented as successful empty datasets. Sequential extraction
is not a transactionally consistent database snapshot. Review `complete` and failures
before using the files. Zero rows may still reflect source permission filtering.

Tables cover membership, profiles, league configuration excluding join code, teams,
fixtures, ownership, roster movements, saved lineups, visible trades, draws/results,
deadlines/reports, archives, all-time records and the user's own current interests,
predictions, votes and notifications. Other managers' current private planning lists
are not queried. Only completed draw snapshots are retained. Historical outcomes
include manager/player/rank, winner, won/lost/unawarded and separate claim/forfeit
flags. Missing snapshots are recorded. Raw visible trades and a terminal-status
subset are included. Trade broadcast notifications are retained as supporting
evidence and are not fabricated into complete structured trade records.

FPL requests are now excluded by default, including in the manual export workflow.
Older packages may contain FPL files; the sync importer ignores them. League
records retain player references needed to understand squads, trades and draws.

## Temporary files and encryption

The public repository receives no raw data commits, logs or plaintext artifacts.
The bundle is a virtual file map (`files[path]`) containing ordinary JSON arrays or
objects, plus a manifest with source counts, hashes and limitations. It is gzip
compressed and encrypted with AES-256-GCM using a scrypt key derived from the
Castle-only password at export time. Random salt and IV make each export unique.
No credential, Supabase token, cookie or session state is included.

Actions retains `castle-data.enc.json` plus a record-count `summary.json` for three
days. The summary replaces league identifiers with generic scopes. Download the
artifact to keep an encrypted copy before it expires. A changed password cannot
decrypt an older export: use the password from export time or rerun the export.
Confidentiality depends on keeping that password private and difficult to guess.

Inside an authorized GCP runner, read the existing Secret Manager credential into
memory as the collector does, then call:

```javascript
import { openExport } from './scripts/castle-inventory-export.mjs';
const bundle = openExport(envelope, credential.password);
// bundle.files['leagues/<source-id>/draw-interest-outcomes.json']
// contains per-manager historical outcomes. Pass JSON to a reviewed importer.
```

No importer is executed by this workflow. Do not commit decrypted files or print
them in Actions logs. For the proposed repeatable database load and schema mapping,
see the [Castle source sync runbook](../runbooks/castle-source-sync.md). The separate
export workflow still performs no import. Source trade access restrictions remain.

Validation: `node --test scripts/castle-inventory*.test.mjs` covers pagination,
source count drift, historical outcomes, scope and encryption integrity.
