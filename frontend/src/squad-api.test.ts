import { afterEach, describe, expect, test, vi } from 'vitest';

import { HttpSquadClient } from './squad-api';

afterEach(() => vi.unstubAllGlobals());

describe('HttpSquadClient', () => {
  test('posts a selected trade target to the squad trade API', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        offered_to_team_id: 'team-rival',
        offered_player_ids: ['fpl-1'],
        requested_player_ids: ['fpl-2'],
      });
      return new Response(JSON.stringify({ id: 'trade-1', status: 'proposed' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const trade = await new HttpSquadClient().createTrade('team-rival', ['fpl-1'], ['fpl-2']);

    expect(trade).toEqual({ id: 'trade-1', status: 'proposed' });
    expect(fetchMock).toHaveBeenCalledWith('/api/trades', expect.objectContaining({ credentials: 'include' }));
  });

  test('rejects malformed history responses instead of inventing profile data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));

    await expect(new HttpSquadClient().getPlayerHistory('fpl-1')).rejects.toThrow(
      'FPL history response is incomplete.',
    );
  });
});
