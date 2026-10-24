import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, validateCredential, safeFailure } from './castle-inventory-gcp.mjs';
import { API } from './castle-inventory.mjs';
const credential = { email: 'test@example.test', password: 'fake-test-value', apikey: 'sb_publishable_example' };
const user = { id: 'fake-id', email: credential.email, aud: 'authenticated', is_anonymous: false };

test('safe diagnostics preserve known failures and suppress arbitrary exception text', () => {
  for (const message of ['An authenticated personal account is required',
    'Session expired or rejected. Sign in again.',
    'Could not establish league membership; no league reads attempted.']) {
    assert.equal(safeFailure(new Error(message)), message);
  }
  assert.equal(safeFailure(new Error('Castle unexpected secret=fake-value')), 'Castle collector stopped; no credentials logged.');
  assert.equal(safeFailure(new Error('Castle authentication rejected (HTTP 400)')), 'Castle authentication rejected (HTTP 400)');
});

test('accepts public keys and rejects service-role keys', () => {
  assert.equal(validateCredential(credential), credential);
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  assert.throws(() => validateCredential({ ...credential, apikey: jwt }), /Administrative/);
  assert.throws(() => validateCredential({ ...credential, password: '' }), /Missing/);
});
test('password exchange targets only Castle and verifies personal identity', async () => {
  const session = await authenticate(credential, async (url, options) => {
    assert.equal(url, `${API}/auth/v1/token?grant_type=password`);
    assert.equal(options.redirect, 'error');
    assert.equal(JSON.parse(options.body).email, credential.email);
    return Response.json({ access_token: 'fake-token', user });
  });
  assert.equal(session.user.id, user.id);
  await assert.rejects(authenticate(credential, async () => Response.json({ access_token: 'fake', user: { ...user, email: 'other@example.test' } })), /expected personal/);
});
test('authentication errors never include upstream secret-bearing text', async () => {
  await assert.rejects(authenticate(credential, async () => new Response('sensitive-response', { status: 400 })),
    (error) => error.message === 'Castle authentication rejected (HTTP 400)');
});
