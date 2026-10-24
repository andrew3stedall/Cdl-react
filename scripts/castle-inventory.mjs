import { createRequire } from 'node:module';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const APP = 'https://castle-draft-league.lovable.app';
export const API = 'https://uqaigbmofxhufamxylot.supabase.co';
const LEAGUE_TABLES = ['castle_teams', 'castle_fixtures', 'draft_picks', 'roster_moves',
  'lineups', 'trades', 'draws', 'draw_results', 'gw_deadlines', 'gw_reports',
  'season_archives', 'player_interests', 'predictions', 'top8_votes', 'notifications'];
const GLOBAL_TABLES = ['cdl_alltime_baseline', 'cdl_alltime_positions', 'cdl_records'];

export function sessionFromState(state) {
  const origin = state.origins.find((o) => o.origin === APP);
  const entry = origin?.localStorage.find((s) => s.name === 'sb-uqaigbmofxhufamxylot-auth-token');
  if (!entry) return null;
  try {
    const s = JSON.parse(entry.value);
    return typeof s.access_token === 'string' && typeof s.user?.id === 'string' ? s : null;
  } catch { return null; }
}

export class CastleReader {
  constructor(apikey, token, transport = fetch) {
    this.headers = { apikey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    this.transport = transport;
  }

  async request(path, body) {
    // Only source-documented reads are accepted; no RPC or write endpoint escape hatch.
    if (!/^\/rest\/v1\/[a-z_]+\?/.test(path) &&
        !/^\/functions\/v1\/fpl-(bootstrap|fixtures|gw-live|player-history)$/.test(path)) {
      throw new Error('Read endpoint is not allowlisted');
    }
    if (path.startsWith('/rest/') && body !== undefined) {
      throw new Error('Database writes are prohibited');
    }
    let response;
    try {
      response = await this.transport(`${API}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...this.headers, Prefer: 'count=exact' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000), redirect: 'error',
      });
    } catch { return { status: 'network_error' }; }
    if (response.status === 401) throw new Error('Session expired or rejected. Sign in again.');
    if (!response.ok) return { status: 'http_error', http_status: response.status };
    let data;
    try { data = await response.json(); } catch { return { status: 'invalid_json' }; }
    return { status: 'ok', data, range: response.headers.get('content-range') };
  }

  async table(table, filters = {}, columns = '*', limit = 100) {
    const allowed = ['leagues', 'league_members', 'profiles', ...LEAGUE_TABLES, ...GLOBAL_TABLES];
    if (!allowed.includes(table)) throw new Error('Unknown source table');
    const params = new URLSearchParams({ select: columns, limit: String(limit), ...filters });
    return this.request(`/rest/v1/${table}?${params}`);
  }
}

export function describe(result) {
  if (result.status !== 'ok') return result;
  const rows = Array.isArray(result.data) ? result.data : [result.data];
  const total = result.range?.split('/')[1];
  return {
    status: rows.length ? 'readable' : 'empty_or_filtered',
    visible_row_count: total && total !== '*' ? Number(total) : null,
    sampled_rows: rows.length,
    fields_observed: [...new Set(rows.flatMap((r) => r && typeof r === 'object' ? Object.keys(r) : []))].sort(),
    note: 'Counts apply only to this user and query. Fields come from sampled rows; no schema completeness claim.',
  };
}

export async function inventory(reader, userId, onProgress = () => {}) {
  const entries = [];
  const record = (scope, table, result) => {
    onProgress(`${table}: ${result.status}`);
    entries.push({ scope, table, ...describe(result) });
  };
  const membership = await reader.table('league_members', { user_id: `eq.${userId}` }, 'league_id');
  record('self', 'league_members', membership);
  if (membership.status !== 'ok' || !Array.isArray(membership.data)) {
    throw new Error('Could not establish league membership; no league reads attempted.');
  }
  const leagues = [...new Set(membership.data.map((m) => m.league_id))];
  for (let index = 0; index < leagues.length; index++) {
    const league = leagues[index];
    const scope = `league_${index + 1}`;
    record(scope, 'leagues', await reader.table('leagues', { id: `eq.${league}` },
      'id,name,status,commissioner_id,settings,current_round,season_number,season_label'));
    const members = await reader.table('league_members', { league_id: `eq.${league}` });
    record(scope, 'league_members', members);
    if (members.status === 'ok' && members.data.length) {
      const ids = [...new Set(members.data.map((m) => m.user_id))];
      record(scope, 'profiles', await reader.table('profiles', { id: `in.(${ids.join(',')})` }));
    }
    for (const table of LEAGUE_TABLES) {
      const filters = { league_id: `eq.${league}` };
      // Private planning data is restricted to this user even if a policy is overbroad.
      if (['player_interests', 'notifications', 'predictions', 'top8_votes'].includes(table)) {
        filters.user_id = `eq.${userId}`;
      }
      record(scope, table, await reader.table(table, filters));
    }
  }
  for (const table of GLOBAL_TABLES) record('global', table, await reader.table(table));
  const bootstrap = await reader.request('/functions/v1/fpl-bootstrap', {});
  record('fpl', 'fpl-bootstrap', bootstrap);
  record('fpl', 'fpl-fixtures', await reader.request('/functions/v1/fpl-fixtures', {}));
  if (bootstrap.status === 'ok') {
    const gw = bootstrap.data.events?.find((e) => e.is_current)?.id;
    const player = bootstrap.data.elements?.[0]?.id;
    if (Number.isInteger(gw)) record('fpl', 'fpl-gw-live',
      await reader.request('/functions/v1/fpl-gw-live', { gameweek: gw }));
    if (Number.isInteger(player)) record('fpl', 'fpl-player-history',
      await reader.request('/functions/v1/fpl-player-history', { playerId: player }));
  }
  return { created_at: new Date().toISOString(), source: API, league_count: leagues.length,
    purpose: 'Read-access inventory; no raw rows, identifiers, credentials or session state exported.',
    limitations: ['No comparison with every frontend view has been performed.',
      'Empty results do not prove a table is empty or inaccessible.',
      'Only documented endpoints tested; no RPCs invoked.',
      'Sampled fields and visible counts are not a full data export.'], entries };
}

async function main() {
  const require = createRequire(new URL('../frontend/package.json', import.meta.url));
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext();
  let apikey;
  context.on('request', (request) => {
    if (new URL(request.url()).origin === API) {
      const value = request.headers().apikey;
      if (value) apikey = value;
    }
  });
  try {
    const page = await context.newPage();
    console.log('Sign in with Google in the Chrome window. Credentials stay in memory.');
    await page.goto(`${APP}/auth`);
    const deadline = Date.now() + 10 * 60_000;
    let session;
    while (Date.now() < deadline && !page.isClosed()) {
      session = sessionFromState(await context.storageState());
      if (session && apikey) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!session || !apikey) throw new Error('Sign-in timed out; no inventory collected.');
    const reader = new CastleReader(apikey, session.access_token);
    const report = await inventory(reader, session.user.id, console.log);
    const directory = await mkdtemp(join(tmpdir(), 'cdl-inventory-'));
    const destination = join(directory, 'inventory.json');
    await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(`Inventory saved: ${destination}`);
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('Collector stopped. Check Chrome/login, dependencies and network; credentials are never logged.');
    process.exitCode = 1;
  });
}
