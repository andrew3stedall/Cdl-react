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

FPL files include bootstrap, fixtures, live payloads for current/completed events and
history for every player in the bootstrap. Requests run sequentially, with a short
pause between player histories. Failed individual reads remain listed in the
manifest; retry before relying on a complete FPL collection.

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
them in Actions logs. The export is intended as temporary input for a later CDL
React mapping/import task. Source access restrictions still apply to trade history.

Validation: `node --test scripts/castle-inventory*.test.mjs` covers pagination,
source count drift, historical outcomes, scope and encryption integrity.
