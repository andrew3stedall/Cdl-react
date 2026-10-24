# Castle authenticated data inventory

This local diagnostic establishes what Andrew's personal Castle/Lovable user can
read before implementing synchronization into CDL React. It does not import data
into CDL React or change either app's database or authentication configuration.

## Run through GitHub Actions and GCP (phone-compatible)

The **Castle Read Inventory** workflow uses the repo's existing staging
Workload Identity Federation and `github-deploy` service account. It runs only on
trusted `main`, reads a secret and calls source read endpoints. No local computer
or browser is required. It has no schedule and does not deploy the application.
It also runs after trusted main changes to its collector scripts or workflow, so
merged collector fixes are validated automatically. PR code never receives secrets.
Stage and endpoint-status messages identify failures without printing credentials,
raw rows or arbitrary exception text.

One-time setup remains required before the workflow can succeed:

1. With Andrew's explicit agreement, add a **Castle-only** password to the existing
   personal account. Supabase supports adding password auth to an OAuth-created
   user. Castle's existing `/reset-password` screen calls `auth.updateUser`, and
   its sign-in page supports requesting the recovery email. Complete this on the
   phone. This changes the Castle credential, not the Google password. Google
   sign-in remains available. Hosted provider settings and recovery delivery must
   still be verified; do not create a second account if this is rejected.
2. In the GCP Console for `cdl-react-staging-ast`, create the Secret Manager secret
   `castle-personal-read-credential` containing JSON with `email`, `password` and
   `apikey`. The key is Castle's public frontend Supabase publishable/anon key,
   never a service-role key. Enter the credential directly in Secret Manager,
   not in chat, GitHub inputs, repository variables or commits.
3. Verify the staging deploy account can access that specific secret. If needed,
   grant `roles/secretmanager.secretAccessor` on this secret only. Existing
   project roles are not proof of effective access. This PR does not change IAM.
4. After the PR is merged, run **Castle Read Inventory** from Actions using main.
   The report is attached as an artifact retained for three days. No live run has
   been performed and no credential has been provisioned by this PR.

The Node runner reads the secret through `gcloud` into memory, exchanges the
Castle email/password for a user session, verifies the returned email and user
audience, and runs the same scoped inventory. It never submits the Google password.
No refresh token is persisted or rotated in Secret Manager. Each manual run logs
in again; a source CAPTCHA/MFA or rejected login is a blocker, not bypassed.
The report does not contain credentials or raw rows. The personal app password
grants the account's normal permissions; the collector constrains its own calls
to reads but does not turn the credential into a server-enforced read-only token.

Validate both runners with:

```bash
node --test scripts/castle-inventory.test.mjs scripts/castle-inventory-gcp.test.mjs
```

## Optional local runner

Use Node.js 22+ and an installed Google Chrome. From the repository root:

```bash
cd frontend
npm ci
cd ..
node scripts/castle-inventory.mjs
```

The script reuses the frontend's existing `@playwright/test` dependency. A separate,
temporary Chrome session opens. Sign in normally with your personal Google account
and complete any Google verification. If Google rejects the browser, stop; do not
bypass verification or supply credentials through chat. Closing Chrome stops the run.

The collector waits up to ten minutes for the app's normal Supabase session and
public project key, then uses the short-lived access token for source reads. Tokens,
cookies and storage state stay in process memory and are not written to a file.
This does not reuse the ChatGPT cloud browser's session. Sign-in in the local Chrome
window is required. There is no refresh-token persistence or unattended scheduling.

At completion the terminal prints the path of `inventory.json` in a new temporary
directory outside the checkout. Keep a copy if needed; temporary directories can be
cleaned by the OS. The report contains endpoint status, counts visible to this user,
and field names observed in at most 100 rows per query. It omits raw row values,
user/league identifiers, tokens and cookies. You can share this report for review.

## Scope and interpretation

League scopes come from the signed-in user's membership rows. The collector reads
league settings, members, teams, fixtures, picks, roster movements, saved lineups,
trades/loans, draws/results, deadlines, reports and season archives. Interests,
notifications, predictions and top-eight votes are additionally restricted to the
signed-in user. All-time records/baselines/positions are checked separately.
The league query excludes the join code.

Four documented FPL read functions are checked: bootstrap, fixtures, current live
gameweek (when available), and one player's history. These use POST because that is
the source app's contract, but they fetch data rather than mutate league records.
No RPC or scoring/draft/trade mutation is invoked. Upstream reads may warm server caches.

`readable` proves this particular query returned rows. `empty_or_filtered` does not
distinguish an empty table from RLS filtering. `http_error` records the HTTP status
without copying potentially sensitive server error text. A 401 stops the run.
Field names are sampled, not a complete schema. Counts are scoped to the caller and
filters, never database-wide totals. Missing source tables are reported, not created.

The report does not yet establish which returned information is absent from every
frontend screen, nor prove historical ownership reconstruction or full pagination.
It is the input to that comparison and the future import mapping. FPL persistent
player codes should be preferred over season-specific element IDs when mapping.

## Validation

```bash
node --test scripts/castle-inventory.test.mjs
node --check scripts/castle-inventory.mjs
```

Automated tests cover scope, secret omission, mutation rejection, expiry and failed
membership discovery. Real local Google sign-in and live source reads remain required.

Source references: [Castle source contracts](https://github.com/andrew3stedall/castle-draft-league/blob/main/docs/edge-functions-reference.md),
[source types](https://github.com/andrew3stedall/castle-draft-league/blob/main/src/integrations/supabase/types.ts),
[Supabase REST](https://supabase.com/docs/guides/api),
[Playwright authentication](https://playwright.dev/docs/auth).

## Live validation findings

The 2026-10-25 Melbourne retry confirmed Secret Manager access, personal Castle
login and successful REST reads through predictions. The collector then rejected
`top8_votes` locally because its table-path pattern excluded digits. The corrected
pattern accepts digits after the first letter; mutation rejection remains tested.
Full inventory completion and field/count assessment still require the next run.
