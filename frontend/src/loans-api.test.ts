import { afterEach, describe, expect, test, vi } from 'vitest';

import { HttpLoansClient } from './loans-api';

afterEach(() => vi.unstubAllGlobals());

describe('HttpLoansClient', () => {
  test('uses the documented routes, wrappers, and party decision body', async () => {
    const loan = { id: 'loan/1' };
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ loan }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpLoansClient('/api');

    await expect(client.createLoan({ player_id: 'player-1', borrower_team_id: 'team-2', duration_gameweeks: 4 })).resolves.toEqual({ loan });
    await expect(client.decideLoan('loan/1', 'agreed')).resolves.toEqual({ loan });
    await expect(client.approveLoan('loan/1', 'rejected')).resolves.toEqual({ loan });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/loans',
      '/api/loans/loan%2F1',
      '/api/loans/loan%2F1/approve',
    ]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      method: 'POST',
      body: JSON.stringify({ player_id: 'player-1', borrower_team_id: 'team-2', duration_gameweeks: 4 }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ status: 'agreed' }) });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ decision: 'rejected' }) });
  });

  test.each([
    [404, 'Loan not found.'],
    [409, 'Loan is no longer awaiting party agreement.'],
  ])('keeps API %s detail text actionable', async (status, detail) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail }), { status })));
    const client = new HttpLoansClient('/api');

    await expect(client.getLoans()).rejects.toMatchObject({ status, message: detail });
  });
});
