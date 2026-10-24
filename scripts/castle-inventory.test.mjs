import test from 'node:test';
import assert from 'node:assert/strict';
import { APP, API, CastleReader, describe, inventory, sessionFromState } from './castle-inventory.mjs';

test('session selection is restricted to the Castle app and project', () => {
  const item = { name: 'sb-uqaigbmofxhufamxylot-auth-token', value: JSON.stringify({ access_token: 'fake', user: { id: 'user' } }) };
  assert.equal(sessionFromState({ origins: [{ origin: 'https://other.test', localStorage: [item] }] }), null);
  assert.equal(sessionFromState({ origins: [{ origin: APP, localStorage: [item] }] }).user.id, 'user');
});

test('report omits values and distinguishes empty reads from denial', () => {
  const report = describe({ status: 'ok', data: [{ private_value: 'do-not-export' }], range: '0-0/28' });
  assert.equal(report.visible_row_count, 28);
  assert.deepEqual(report.fields_observed, ['private_value']);
  assert.ok(!JSON.stringify(report).includes('do-not-export'));
  assert.equal(describe({ status: 'ok', data: [] }).status, 'empty_or_filtered');
  assert.equal(describe({ status: 'http_error', http_status: 403 }).http_status, 403);
});

test('transport rejects mutation and RPC endpoints before sending requests', async () => {
  const reader = new CastleReader('public', 'fake', () => { throw new Error('must not send'); });
  await assert.rejects(reader.request('/rest/v1/lineups?select=*', {}), /writes/);
  await assert.rejects(reader.request('/rest/v1/rpc/upsert_lineup', {}), /allowlisted/);
  await assert.rejects(reader.request('/functions/v1/score-gameweek', {}), /allowlisted/);
});

test('documented top8_votes read permits digits without permitting a write', async () => {
  let calls = 0;
  const reader = new CastleReader('public', 'fake', async (url, options) => {
    calls++;
    assert.equal(new URL(url).pathname, '/rest/v1/top8_votes');
    assert.equal(options.method, 'GET');
    return Response.json([]);
  });
  assert.equal((await reader.table('top8_votes', { user_id: 'eq.self', league_id: 'eq.league' })).status, 'ok');
  await assert.rejects(reader.request('/rest/v1/top8_votes?select=*', {}), /writes/);
  assert.equal(calls, 1);
});

test('transport binds requests to source and stops on expired authentication', async () => {
  const reader = new CastleReader('public', 'fake', async (url, options) => {
    assert.equal(new URL(url).origin, API);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    return new Response('{}', { status: 401 });
  });
  await assert.rejects(reader.table('leagues'), /expired or rejected/);
});

test('inventory scopes league and private reads and emits no raw identifiers', async () => {
  const calls = [];
  const reader = {
    async table(table, filters, columns) {
      calls.push({ table, filters, columns });
      if (table === 'league_members' && filters.user_id) return { status: 'ok', data: [{ league_id: 'league-secret' }] };
      if (table === 'league_members') return { status: 'ok', data: [{ user_id: 'user-secret' }] };
      return { status: 'ok', data: [{ id: 'row-secret' }], range: '0-0/1' };
    },
    async request() { return { status: 'http_error', http_status: 404 }; },
  };
  const report = await inventory(reader, 'user-secret');
  assert.equal(report.league_count, 1);
  for (const table of ['player_interests', 'notifications', 'predictions', 'top8_votes']) {
    const call = calls.find((c) => c.table === table);
    assert.equal(call.filters.league_id, 'eq.league-secret');
    assert.equal(call.filters.user_id, 'eq.user-secret');
  }
  assert.ok(!JSON.stringify(report).includes('secret'));
});

test('failed membership discovery prevents further reads', async () => {
  let calls = 0;
  await assert.rejects(inventory({ async table() { calls++; return { status: 'http_error', http_status: 403 }; } }, 'user'), /membership/);
  assert.equal(calls, 1);
});
