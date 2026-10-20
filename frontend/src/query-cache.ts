import { QueryClient, dehydrate, hydrate, type DehydratedState } from '@tanstack/react-query';

const CACHE_PREFIX = 'cdl-api-v1';
const DATABASE_NAME = 'cdl-react-query-cache';
const DATABASE_VERSION = 1;
const OBJECT_STORE = 'query-clients';
const DEFAULT_STALE_TIME = Infinity;

interface CachedResponse {
  body: string;
  headers: [string, string][];
  status: number;
  statusText: string;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME,
      gcTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

let cacheUserId: string | null = null;
let hydration: Promise<void> = Promise.resolve();
let persistenceQueue = Promise.resolve();
let persistenceTimer: ReturnType<typeof setTimeout> | null = null;
let queryUpdateTimer: ReturnType<typeof setTimeout> | null = null;
let restoringCache = false;
let scopeRevision = 0;

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}:${userId}`;
}

function openCacheDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OBJECT_STORE)) database.createObjectStore(OBJECT_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function readPersistedCache(userId: string): Promise<DehydratedState | undefined> {
  const database = await openCacheDatabase();
  if (!database) return undefined;
  return new Promise((resolve) => {
    const request = database.transaction(OBJECT_STORE, 'readonly').objectStore(OBJECT_STORE).get(cacheKey(userId));
    request.onsuccess = () => {
      database.close();
      resolve(request.result as DehydratedState | undefined);
    };
    request.onerror = () => {
      database.close();
      resolve(undefined);
    };
  });
}

function writePersistedCache(userId: string, state: DehydratedState): Promise<void> {
  return openCacheDatabase().then((database) => {
    if (!database) return;
    return new Promise<void>((resolve) => {
      const transaction = database.transaction(OBJECT_STORE, 'readwrite');
      transaction.objectStore(OBJECT_STORE).put(state, cacheKey(userId));
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); resolve(); };
      transaction.onabort = () => { database.close(); resolve(); };
    });
  });
}

function deletePersistedCache(userId: string): Promise<void> {
  return openCacheDatabase().then((database) => {
    if (!database) return;
    return new Promise<void>((resolve) => {
      const transaction = database.transaction(OBJECT_STORE, 'readwrite');
      transaction.objectStore(OBJECT_STORE).delete(cacheKey(userId));
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); resolve(); };
      transaction.onabort = () => { database.close(); resolve(); };
    });
  });
}

function persistCacheSoon(): void {
  if (!cacheUserId || restoringCache || typeof indexedDB === 'undefined') return;
  if (persistenceTimer !== null) clearTimeout(persistenceTimer);
  persistenceTimer = setTimeout(() => {
    persistenceTimer = null;
    const userId = cacheUserId;
    if (!userId) return;
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => query.state.status === 'success',
    });
    persistenceQueue = persistenceQueue.then(() => writePersistedCache(userId, state));
  }, 100);
}

function notifyQueryDataUpdated(): void {
  if (typeof document === 'undefined') return;
  if (queryUpdateTimer !== null) clearTimeout(queryUpdateTimer);
  queryUpdateTimer = setTimeout(() => {
    queryUpdateTimer = null;
    document.dispatchEvent(new Event('cdl:query-cache-updated'));
  }, 100);
}

queryClient.getQueryCache().subscribe(persistCacheSoon);

export function setQueryCacheUser(userId: string | null): Promise<void> {
  if (cacheUserId === userId) return hydration;
  const revision = ++scopeRevision;
  restoringCache = true;
  if (queryUpdateTimer !== null) {
    clearTimeout(queryUpdateTimer);
    queryUpdateTimer = null;
  }
  if (persistenceTimer !== null) {
    clearTimeout(persistenceTimer);
    persistenceTimer = null;
  }
  cacheUserId = userId;
  queryClient.clear();
  if (!userId) {
    restoringCache = false;
    hydration = Promise.resolve();
    return hydration;
  }

  hydration = readPersistedCache(userId).then((state) => {
    if (scopeRevision === revision && cacheUserId === userId) {
      if (state) {
        hydrate(queryClient, state);
        void queryClient.invalidateQueries({ queryKey: [CACHE_PREFIX, userId], refetchType: 'none' });
      }
      restoringCache = false;
      persistCacheSoon();
    }
  });
  return hydration;
}

export async function clearQueryCache(): Promise<void> {
  scopeRevision += 1;
  restoringCache = false;
  const previousUserId = cacheUserId;
  cacheUserId = null;
  if (persistenceTimer !== null) {
    clearTimeout(persistenceTimer);
    persistenceTimer = null;
  }
  if (queryUpdateTimer !== null) {
    clearTimeout(queryUpdateTimer);
    queryUpdateTimer = null;
  }
  queryClient.clear();
  await persistenceQueue;
  if (previousUserId) await deletePersistedCache(previousUserId);
}

export function invalidateQueryCache(): void {
  if (!cacheUserId) return;
  void queryClient.invalidateQueries({ queryKey: [CACHE_PREFIX, cacheUserId], refetchType: 'none' });
}

function shouldCacheRequest(url: URL, method: string, cacheMode?: RequestCache): boolean {
  if (method !== 'GET' || !cacheUserId || cacheMode === 'no-store') return false;
  if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/passkeys/')) return false;
  if (url.pathname.startsWith('/api/live-draft/') || url.pathname.startsWith('/webmcp/')) return false;
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/oauth/');
}

function createResponse(snapshot: CachedResponse): Response {
  return new Response(snapshot.status === 204 || snapshot.status === 205 || snapshot.status === 304 ? null : snapshot.body, {
    headers: snapshot.headers,
    status: snapshot.status,
    statusText: snapshot.statusText,
  });
}

export async function fetchWithQuery(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
  const url = new URL(request?.url ?? String(input), typeof window === 'undefined' ? 'http://localhost' : window.location.href);
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
  const fetcher = globalThis.fetch.bind(globalThis);

  if (!shouldCacheRequest(url, method, init?.cache ?? request?.cache)) {
    const response = await fetcher(input, init);
    if (method !== 'GET' && response.ok) invalidateQueryCache();
    return response;
  }

  await hydration;
  const userId = cacheUserId;
  if (!userId) return fetcher(input, init);
  const headers = new Headers(request?.headers);
  new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
  const accept = headers.get('accept') ?? '';
  const queryKey = [CACHE_PREFIX, userId, url.href, accept] as const;
  const queryOptions = {
    queryKey,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: Infinity,
    queryFn: async () => {
      const response = await fetcher(input, init);
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      return {
        body: await response.clone().text(),
        headers: [...response.headers.entries()].filter(([name]) => !['content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(name.toLowerCase())),
        status: response.status,
        statusText: response.statusText,
      };
    },
  };

  const cachedSnapshot = queryClient.getQueryData<CachedResponse>(queryKey);
  if (cachedSnapshot) {
    const query = queryClient.getQueryCache().find({ queryKey, exact: true });
    if (query?.state.isInvalidated && !query.state.fetchStatus.startsWith('fetching')) {
      void queryClient.fetchQuery<CachedResponse>(queryOptions)
        .then(notifyQueryDataUpdated)
        .catch(() => undefined);
    }
    return createResponse(cachedSnapshot);
  }

  const snapshot = await queryClient.fetchQuery<CachedResponse>(queryOptions);

  return createResponse(snapshot);
}

if (typeof document !== 'undefined') {
  document.addEventListener('cdl:data-invalidated', invalidateQueryCache);
}
