const CACHE_NAME = 'cdl-pwa-v1';
const BASE_URL = new URL('./', self.location.href);
const APP_SHELL = [
  BASE_URL.href,
  new URL('manifest.webmanifest', BASE_URL).href,
  new URL('pwa-192.png', BASE_URL).href,
  new URL('pwa-512.png', BASE_URL).href,
];

function isCacheable(response) {
  return response && response.ok && response.type === 'basic';
}

function cacheResponse(request, response) {
  if (!isCacheable(response)) {
    return Promise.resolve(response);
  }

  return caches
    .open(CACHE_NAME)
    .then((cache) => cache.put(request, response.clone()))
    .catch(() => undefined)
    .then(() => response);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          APP_SHELL.map((url) =>
            fetch(url, { cache: 'no-cache' }).then((response) => {
              if (isCacheable(response)) {
                return cache.put(url, response);
              }
              return undefined;
            }),
          ),
        ),
      )
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('cdl-pwa-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.includes('/api/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(BASE_URL.href, response))
        .catch(() => caches.match(BASE_URL.href)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => cacheResponse(request, response));
    }),
  );
});
