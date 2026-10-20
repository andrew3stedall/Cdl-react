import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { clearQueryCache, fetchWithQuery, invalidateQueryCache, setQueryCacheUser } from './query-cache';

describe('TanStack API response cache', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await clearQueryCache();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearQueryCache();
  });

  it('returns a successful API response from cache on subsequent reads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ teams: ['A'] }), {
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await setQueryCacheUser('manager-1');

    const first = await fetchWithQuery('/api/league/table', { credentials: 'include' });
    const second = await fetchWithQuery('/api/league/table', { credentials: 'include' });

    expect(await first.json()).toEqual({ teams: ['A'] });
    expect(await second.json()).toEqual({ teams: ['A'] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('restores cached API responses from IndexedDB after the in-memory client is cleared', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ restored: true }), {
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await setQueryCacheUser('manager-1');

    await fetchWithQuery('/api/league/table');
    await new Promise((resolve) => setTimeout(resolve, 150));
    await setQueryCacheUser('manager-2');
    await setQueryCacheUser('manager-1');

    const update = new Promise<void>((resolve) => document.addEventListener('cdl:query-cache-updated', () => resolve(), { once: true }));
    expect(await (await fetchWithQuery('/api/league/table')).json()).toEqual({ restored: true });
    await update;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves cached data immediately and refreshes it in the background after invalidation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 1 }), { headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 2 }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await setQueryCacheUser('manager-1');

    expect(await (await fetchWithQuery('/api/squad/workspace')).json()).toEqual({ revision: 1 });
    invalidateQueryCache();
    const updated = new Promise<void>((resolve) => document.addEventListener('cdl:query-cache-updated', () => resolve(), { once: true }));
    expect(await (await fetchWithQuery('/api/squad/workspace')).json()).toEqual({ revision: 1 });
    await updated;
    expect(await (await fetchWithQuery('/api/squad/workspace')).json()).toEqual({ revision: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps each manager cache isolated and bypasses authentication endpoints', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Response(JSON.stringify({ manager: fetchMock.mock.calls.length }), {
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await setQueryCacheUser('manager-1');
    const first = await (await fetchWithQuery('/api/squad/workspace')).json();
    await setQueryCacheUser('manager-2');
    const second = await (await fetchWithQuery('/api/squad/workspace')).json();
    await fetchWithQuery('/api/auth/session');

    expect(first).not.toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('removes the signed-in manager cache after sign-out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ private: true }), {
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await setQueryCacheUser('manager-1');
    await fetchWithQuery('/api/squad/workspace');
    await new Promise((resolve) => setTimeout(resolve, 150));

    await clearQueryCache();
    await setQueryCacheUser('manager-1');
    expect(await (await fetchWithQuery('/api/squad/workspace')).json()).toEqual({ private: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('invalidates cached data after a successful write', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 1 }), { headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 2 }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await setQueryCacheUser('manager-1');

    await fetchWithQuery('/api/squad/workspace');
    await fetchWithQuery('/api/squad/changes', { method: 'POST', body: '{}' });
    const updated = new Promise<void>((resolve) => document.addEventListener('cdl:query-cache-updated', () => resolve(), { once: true }));
    expect(await (await fetchWithQuery('/api/squad/workspace')).json()).toEqual({ revision: 1 });
    await updated;
    expect(await (await fetchWithQuery('/api/squad/workspace')).json()).toEqual({ revision: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
