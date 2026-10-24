import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

const TABLES = ['castle_teams', 'castle_fixtures', 'draft_picks', 'roster_moves', 'lineups',
  'trades', 'draws', 'draw_results', 'gw_deadlines', 'gw_reports', 'season_archives',
  'player_interests', 'predictions', 'top8_votes', 'notifications'];
const GLOBAL = ['cdl_alltime_baseline', 'cdl_alltime_positions', 'cdl_records'];
const SELF = new Set(['player_interests', 'predictions', 'top8_votes', 'notifications']);
const ORDERS = { league_members: 'league_id.asc,user_id.asc', cdl_alltime_baseline: 'manager.asc',
  cdl_alltime_positions: 'manager.asc', cdl_records: 'key.asc' };

export async function allRows(reader, table, filters = {}, columns = '*', pageSize = 200) {
  const rows = [];
  let expected = null;
  for (let page = 0; page < 10000; page++) {
    const result = await reader.table(table, { ...filters, order: ORDERS[table] ?? 'id.asc', offset: String(rows.length) }, columns, pageSize);
    if (result.status !== 'ok' || !Array.isArray(result.data)) throw new Error('Source collection could not be read');
    const count = result.range?.split('/')[1];
    const total = count && count !== '*' ? Number(count) : null;
    if (expected !== null && total !== null && total !== expected) throw new Error('Source count changed during export');
    expected ??= total;
    rows.push(...result.data);
    // Advance by actual received length: servers may impose a smaller page cap.
    if (result.data.length === 0 || (expected !== null && rows.length >= expected)) {
      if (expected !== null && rows.length !== expected) throw new Error('Incomplete source collection');
      return rows;
    }
  }
  throw new Error('Source pagination limit reached');
}

export function drawOutcomes(draws, results, profiles) {
  const names = new Map(profiles.map(p => [p.id, p.display_name]));
  const outcomes = [];
  const coverage = [];
  for (const draw of draws.filter(d => d.status === 'completed')) {
    const snapshot = draw.interests_snapshot;
    const awards = results.filter(r => r.draw_id === draw.id);
    const winner = new Map(awards.map(r => [r.fpl_player_id, r]));
    coverage.push({ draw_id: draw.id, label: draw.label, has_snapshot: snapshot !== null && typeof snapshot === 'object',
      award_count: awards.length, registered_interests: Object.values(snapshot ?? {}).reduce((n, a) => n + a.length, 0) });
    for (const [manager, interests] of Object.entries(snapshot ?? {})) {
      for (const interest of interests) {
        const award = winner.get(interest.fpl_player_id);
        outcomes.push({ draw_id: draw.id, draw_label: draw.label, manager_id: manager,
          manager_name: names.get(manager) ?? null, ...interest,
          outcome: !award ? 'unawarded' : award.user_id === manager ? 'won' : 'lost',
          winner_id: award?.user_id ?? null, winner_name: names.get(award?.user_id) ?? null,
          confirmed: award?.confirmed ?? null, forfeited: award?.forfeited ?? null });
      }
    }
  }
  return { coverage, outcomes };
}

export function sealExport(bundle, password) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', scryptSync(password, salt, 32), iv);
  cipher.setAAD(Buffer.from('castle-export-v1'));
  const bytes = gzipSync(Buffer.from(JSON.stringify(bundle)));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { format: 'castle-export-v1', cipher: 'aes-256-gcm', kdf: 'scrypt', compression: 'gzip',
    salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64') };
}

export function openExport(envelope, password) {
  if (envelope.format !== 'castle-export-v1') throw new Error('Unknown export format');
  const decipher = createDecipheriv('aes-256-gcm', scryptSync(password, Buffer.from(envelope.salt, 'base64'), 32), Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from('castle-export-v1'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return JSON.parse(gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()])));
}

export async function exportData(reader, userId, progress = () => {}) {
  const files = {}, collections = [], failures = [];
  const save = (path, data) => { files[path] = data; return data; };
  const collect = async (path, table, filters = {}, columns = '*') => {
    try {
      const rows = await allRows(reader, table, filters, columns);
      save(path, rows); collections.push({ file: path, rows: rows.length });
      progress(`${table}: ${rows.length} rows exported`);
      return rows;
    } catch { failures.push({ file: path, status: 'read_failed_or_changed' }); return []; }
  };
  const memberships = await allRows(reader, 'league_members', { user_id: `eq.${userId}` });
  save('self/memberships.json', memberships);
  const leagueIds = [...new Set(memberships.map(m => m.league_id))];
  const drawCoverage = [];
  for (let i = 0; i < leagueIds.length; i++) {
    const league = leagueIds[i], root = `leagues/${league}`;
    await collect(`${root}/leagues.json`, 'leagues', { id: `eq.${league}` },
      'id,name,status,commissioner_id,settings,current_round,season_number,season_label');
    const members = await collect(`${root}/league_members.json`, 'league_members', { league_id: `eq.${league}` });
    const profiles = members.length ? await collect(`${root}/profiles.json`, 'profiles',
      { id: `in.(${[...new Set(members.map(m => m.user_id))].join(',')})` }) : [];
    const data = {};
    for (const table of TABLES) {
      const filters = { league_id: `eq.${league}` };
      if (SELF.has(table)) filters.user_id = `eq.${userId}`;
      data[table] = await collect(`${root}/${table}.json`, table, filters);
    }
    // Historical interests only; do not export other managers' future planning snapshots.
    data.draws.forEach(d => { if (d.status !== 'completed') d.interests_snapshot = null; });
    const derived = drawOutcomes(data.draws, data.draw_results, profiles);
    save(`${root}/draw-interest-outcomes.json`, derived);
    drawCoverage.push({ scope: `league_${i + 1}`, completed_draws: derived.coverage.length,
      with_snapshot: derived.coverage.filter(d => d.has_snapshot).length, interest_outcomes: derived.outcomes.length });
    save(`${root}/completed-trades.json`, data.trades.filter(t => ['approved', 'rejected', 'commissioner_rejected', 'cancelled', 'expired'].includes(t.status)));
    save(`${root}/trade-bulletins.json`, data.notifications.filter(n => n.type === 'trade' && n.metadata?.breaking === true));
  }
  for (const table of GLOBAL) await collect(`global/${table}.json`, table);
  const functionRead = async (path, endpoint, body) => {
    try { const r = await reader.request(`/functions/v1/${endpoint}`, body);
      if (r.status !== 'ok') throw new Error('Read failed');
      save(path, r.data); return r.data;
    } catch { failures.push({ file: path, status: 'read_failed' }); return null; }
  };
  const bootstrap = await functionRead('fpl/bootstrap.json', 'fpl-bootstrap', {});
  await functionRead('fpl/fixtures.json', 'fpl-fixtures', {});
  if (bootstrap) {
    for (const event of bootstrap.events ?? []) {
      if (event.finished || event.is_current || event.is_previous) {
        await functionRead(`fpl/live/${event.id}.json`, 'fpl-gw-live', { gameweek: event.id });
      }
    }
    for (const player of bootstrap.elements ?? []) {
      await functionRead(`fpl/player-history/${player.id}.json`, 'fpl-player-history', { playerId: player.id });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  const manifest = { format: 'castle-data-export-v1', exported_at: new Date().toISOString(),
    league_count: leagueIds.length, complete: failures.length === 0, collections, draw_coverage: drawCoverage, failures,
    files: Object.entries(files).map(([name, data]) => ({ name, sha256: createHash('sha256').update(JSON.stringify(data)).digest('hex') })),
    limitations: ['Only rows readable by the personal Castle account, not an administrative export.',
      'Empty collections may reflect RLS filtering.', 'Sequential reads are not a database transaction snapshot.',
      'Historical missing snapshots cannot be reconstructed; unawarded is not automatically lost.',
      'Trade bulletins are source notifications, not a complete or parsed trade ledger.'] };
  return { manifest, files };
}
