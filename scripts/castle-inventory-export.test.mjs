import test from 'node:test';
import assert from 'node:assert/strict';
import { allRows, drawOutcomes, sealExport, openExport, exportData } from './castle-inventory-export.mjs';

test('pagination follows actual server page cap, including exact multiples', async () => {
  const calls = [];
  const data = Array.from({ length: 6 }, (_, id) => ({ id }));
  const reader = { async table(table, filters) { calls.push(filters.offset); const start = Number(filters.offset);
    return { status: 'ok', data: data.slice(start, start + 2), range: `${start}-${start + 1}/6` }; } };
  assert.deepEqual(await allRows(reader, 'draw_results', {}, '*', 200), data);
  assert.deepEqual(calls, ['0', '2', '4']);
});
test('pagination rejects changing counts and truncated results', async () => {
  let calls = 0;
  await assert.rejects(allRows({ async table() { calls++; return { status: 'ok', data: [{ id: calls }], range: `0-0/${calls + 1}` }; } }, 'draws'), /changed/);
  await assert.rejects(allRows({ async table() { return { status: 'ok', data: [], range: '*/3' }; } }, 'draws'), /Incomplete/);
});
test('historical outcomes distinguish won, lost, unawarded and claim status', () => {
  const entry = id => ({ fpl_player_id: id, rank: id });
  const draws = [{ id: 'd', status: 'completed', interests_snapshot: { a: [entry(1), entry(2), entry(3)] } },
    { id: 'old', status: 'completed', interests_snapshot: null }];
  const result = drawOutcomes(draws, [{ draw_id: 'd', fpl_player_id: 1, user_id: 'a', confirmed: false },
    { draw_id: 'd', fpl_player_id: 2, user_id: 'b', forfeited: true }], [{ id: 'b', display_name: 'Other' }]);
  assert.deepEqual(result.outcomes.map(x => x.outcome), ['won', 'lost', 'unawarded']);
  assert.equal(result.outcomes[0].confirmed, false);
  assert.equal(result.outcomes[1].winner_name, 'Other');
  assert.equal(result.coverage[1].has_snapshot, false);
});
test('encrypted package roundtrips and rejects incorrect password or tampering', () => {
  const bundle = { files: { 'draws.json': [{ private: 'sample-record' }] } };
  const sealed = sealExport(bundle, 'test-password');
  assert.ok(!JSON.stringify(sealed).includes('sample-record'));
  assert.deepEqual(openExport(sealed, 'test-password'), bundle);
  assert.throws(() => openExport(sealed, 'wrong-password'));
  assert.throws(() => openExport({ ...sealed, ciphertext: Buffer.alloc(12).toString('base64') }, 'test-password'));
});
test('export scopes private records and excludes future snapshots; keeps visible trades', async () => {
  const calls = [];
  const reader = { async table(table, filters) {
    calls.push({ table, filters });
    let data = [];
    if (table === 'league_members') data = [{ league_id: 'l', user_id: 'self' }];
    if (table === 'draws') data = [{ id: 'd', status: 'pending', interests_snapshot: { other: [{ fpl_player_id: 9 }] } }];
    if (table === 'trades') data = [{ id: 't', status: 'rejected' }];
    return { status: 'ok', data, range: `0-0/${data.length}` };
  }, async request() { throw new Error('FPL must not be requested by default'); } };
  const bundle = await exportData(reader, 'self');
  assert.equal(bundle.files['leagues/l/draws.json'][0].interests_snapshot, null);
  assert.equal(bundle.files['leagues/l/completed-trades.json'][0].status, 'rejected');
  for (const table of ['player_interests', 'notifications', 'predictions', 'top8_votes']) {
    assert.equal(calls.find(c => c.table === table).filters.user_id, 'eq.self');
  }
  assert.equal(bundle.manifest.complete, true);
  assert.ok(Object.keys(bundle.files).every(path => !path.startsWith('fpl/')));
});
