import { afterEach, describe, expect, test, vi } from 'vitest';

import { HttpPlayerProfileDataClient } from './player-profile-data-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpPlayerProfileDataClient', () => {
  test('uses user-scoped scouting routes and includes credentials', async () => {
    const record = { player_id: 'fpl/10', watchlisted: true, note: 'Minutes check', updated_at: null };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(record), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpPlayerProfileDataClient('/api');

    await client.getScoutingRecord('fpl/10');
    await client.saveScoutingRecord('fpl/10', { watchlisted: false, note: '' });
    await client.getWatchlist();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/me/scouting/fpl%2F10',
      '/api/me/scouting/fpl%2F10',
      '/api/me/watchlist',
    ]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      credentials: 'include',
      method: 'PUT',
      body: JSON.stringify({ watchlisted: false, note: '' }),
    });
  });

  test('requests CDL history for the encoded player id', async () => {
    const response = { player_id: 'fpl:10', periods: [] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpPlayerProfileDataClient('/api');

    await expect(client.getOwnershipHistory('fpl:10')).resolves.toEqual(response);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/players/fpl%3A10/cdl-history');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  });
});
