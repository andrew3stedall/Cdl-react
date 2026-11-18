import { afterEach, describe, expect, test, vi } from 'vitest';

import { httpAIConnectionsClient } from './ai-connections-api';

describe('AI connections API routes', () => {
  afterEach(() => vi.restoreAllMocks());

  test('uses the public-root OAuth connection route and API-prefixed execution routes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => (
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ));

    await httpAIConnectionsClient.listConnections();
    await httpAIConnectionsClient.getGrant('connection-1');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/oauth/connections',
      '/api/ai/execution-grants/connection-1',
    ]);
  });

  test('bypasses the shared cache for verification state and posts manual checks', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => (
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ));

    await httpAIConnectionsClient.getDiagnostics();
    await httpAIConnectionsClient.checkConnection('connection/1');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/ai/connections');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/ai/connections/connection%2F1/check');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });
});
