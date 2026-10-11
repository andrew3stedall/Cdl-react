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
});
