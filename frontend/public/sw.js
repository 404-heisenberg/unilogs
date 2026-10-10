// Minimal app-shell cache. Deliberately never touches /api/* — API data
// belongs to TanStack Query, not this cache; a service worker silently serving
// stale API responses would be a real bug.
//
// The HTML shell must NEVER be served from a stale cache copy: every deploy
// renames the hashed chunk files, so an old shell points at URLs that no
// longer exist and navigation breaks with "error loading dynamically imported
// module". Vercel's SPA rewrite answers any missing file with index.html
// (200, text/html), so a missing chunk can even get cached as JavaScript.
// Navigations are therefore network-first (cache only as an offline fallback);
// content-hashed /assets URLs are immutable, so serving them from cache is
// safe and they are revalidated in the background. (See issue #346.)
const CACHE_VERSION = 'unilogs-v3';
const PRECACHE_URLS = ['/', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOriginGet = event.request.method === 'GET' && url.origin === self.location.origin;
  if (!isSameOriginGet || url.pathname.startsWith('/api/')) return;

  // The shell changes on every deploy: go to the network first, keep the
  // cached copy only for when the network is unreachable.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) storeCopy(event.request, response);
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) =>
              cached ??
              new Response('UniLogs is offline. Check your connection.', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' },
              }),
          ),
        ),
    );
    return;
  }

  // Hashed build assets are immutable, so a cached copy is never stale. Serve
  // it right away and revalidate in the background.
  event.respondWith(
    caches
      .match(event.request)
      .catch(() => undefined)
      .then((cached) => {
        const network = fetch(event.request)
          .then((response) => {
            if (response.ok && !isHtmlResponse(response)) storeCopy(event.request, response);
            return response;
          })
          .catch(() => cached);
        // Both can be undefined only when the network is down and nothing is
        // cached. Never hand undefined to respondWith, or the browser fails
        // the request with a confusing service-worker error.
        return cached || network || new Response('', { status: 504 });
      }),
  );
});

function isHtmlResponse(response) {
  return (response.headers.get('content-type') ?? '').includes('text/html');
}

// Store a copy in the background. Store failures (e.g. quota) must never break
// the response the user actually sees.
function storeCopy(request, response) {
  caches
    .open(CACHE_VERSION)
    .then((cache) => cache.put(request, response.clone()))
    .catch(() => {});
}
