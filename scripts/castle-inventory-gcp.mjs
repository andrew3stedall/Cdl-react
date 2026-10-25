import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { API, CastleReader, inventory } from './castle-inventory.mjs';
import { exportData, sealExport } from './castle-inventory-export.mjs';

export function safeFailure(error) {
  const allowed = new Set([
    'Castle authentication network failure', 'Invalid authentication response',
    'Castle did not return the expected personal account',
    'An authenticated personal account is required',
    'Cannot read a valid Castle credential from the staging secret',
    'Run only from the trusted main workflow in the staging project',
    'Session expired or rejected. Sign in again.',
    'Could not establish league membership; no league reads attempted.',
  ]);
  const message = error?.message;
  if (allowed.has(message) || /^Castle authentication rejected \(HTTP [1-5][0-9]{2}\)$/.test(message ?? '')) return message;
  return 'Castle collector stopped; no credentials logged.';
}

export function validateCredential(credential) {
  for (const field of ['email', 'password', 'apikey']) {
    if (typeof credential[field] !== 'string' || !credential[field].trim()) {
      throw new Error(`Missing credential field: ${field}`);
    }
  }
  // The published frontend key is sufficient; never accept an administrative key.
  if (!credential.apikey.startsWith('sb_publishable_')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(credential.apikey.split('.')[1], 'base64url')); }
    catch { throw new Error('Expected the public frontend key'); }
    if (payload.role !== 'anon') throw new Error('Administrative keys are prohibited');
  }
  return credential;
}

export async function authenticate(credential, transport = fetch) {
  validateCredential(credential);
  let response;
  try {
    response = await transport(`${API}/auth/v1/token?grant_type=password`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { apikey: credential.apikey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: credential.email, password: credential.password }),
    });
  } catch { throw new Error('Castle authentication network failure'); }
  if (!response.ok) throw new Error(`Castle authentication rejected (HTTP ${response.status})`);
  let session;
  try { session = await response.json(); } catch { throw new Error('Invalid authentication response'); }
  if (!session.access_token || !session.user?.id ||
      session.user.email?.toLowerCase() !== credential.email.toLowerCase()) {
    throw new Error('Castle did not return the expected personal account');
  }
  if (session.user.is_anonymous || session.user.aud !== 'authenticated') {
    throw new Error('An authenticated personal account is required');
  }
  return session;
}

async function main() {
  if (process.env.GITHUB_REF !== 'refs/heads/main' ||
      process.env.PROJECT_ID !== 'cdl-react-staging-ast' || !process.env.RUNNER_TEMP) {
    throw new Error('Run only from the trusted main workflow in the staging project');
  }
  let credential;
  console.log('Stage: read credential from Secret Manager');
  try {
    const text = execFileSync('gcloud', ['secrets', 'versions', 'access', 'latest',
      '--secret=castle-personal-read-credential', '--project=cdl-react-staging-ast', '--quiet'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 });
    credential = validateCredential(JSON.parse(text));
  } catch { throw new Error('Cannot read a valid Castle credential from the staging secret'); }
  console.log('Stage: authenticate personal Castle account');
  const session = await authenticate(credential);
  if (process.env.CASTLE_EXPORT_DATA === 'true') {
    console.log('Stage: export all permitted source records');
    const bundle = await exportData(new CastleReader(credential.apikey, session.access_token), session.user.id, console.log);
    if (process.env.CASTLE_SYNC_INPUT_PATH) {
      const path = resolve(process.env.CASTLE_SYNC_INPUT_PATH);
      if (dirname(path) !== resolve(process.env.RUNNER_TEMP)) throw new Error('Invalid sync temporary file path');
      await writeFile(path, JSON.stringify(bundle), { mode: 0o600 });
    }
    const directory = join(process.env.RUNNER_TEMP, 'castle-export');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(join(directory, 'castle-data.enc.json'), JSON.stringify(sealExport(bundle, credential.password)), { mode: 0o600 });
    const hideScope = path => path.replace(/leagues\/[^/]+\//, 'leagues/league/');
    const summary = { exported_at: bundle.manifest.exported_at, complete: bundle.manifest.complete,
      league_count: bundle.manifest.league_count, file_count: Object.keys(bundle.files).length,
      collections: bundle.manifest.collections.map(c => ({ ...c, file: hideScope(c.file) })),
      draw_coverage: bundle.manifest.draw_coverage,
      failures: bundle.manifest.failures.map(f => ({ ...f, file: hideScope(f.file) })) };
    await writeFile(join(directory, 'summary.json'), JSON.stringify(summary, null, 2), { mode: 0o600 });
    console.log(`Export saved encrypted: ${summary.file_count} files, ${summary.failures.length} failed reads.`);
    return;
  }
  console.log('Stage: inventory permitted source reads');
  const report = await inventory(new CastleReader(credential.apikey, session.access_token), session.user.id, console.log);
  console.log('Stage: write sanitized inventory report');
  await writeFile(join(process.env.RUNNER_TEMP, 'castle-inventory.json'),
    `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`Castle inventory complete: ${report.league_count} league scopes; report contains no row values.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // All messages above are locally defined; never print upstream bodies or credentials.
    console.error(safeFailure(error));
    process.exitCode = 1;
  });
}
