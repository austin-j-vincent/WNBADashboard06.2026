// WNBA Dashboard PWA Service Worker
//
// Strategy (chosen for a "living dashboard" where freshness matters most):
//  - API requests:  network-only — never cache, so game data is never stale.
//  - Navigation:    network-first — always load the latest deployed app when
//                   online; fall back to the cached shell only when offline.
//  - Other assets:  network-first with cache fallback. Vite content-hashes
//                   asset filenames, so a new deploy fetches new files.
//
// Bumping CACHE_VERSION purges every older cache on activate. This is what
// rescues browsers that were stuck on a previously cached app version.
const CACHE_VERSION = 'v3';
const CACHE_NAME = `wnba-dashboard-${CACHE_VERSION}`;

self.addEventListener('install', () => {
  // Activate this new worker immediately instead of waiting for old tabs.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Delete ALL old caches (including the broken cache-first v1).
      const names = await caches.keys();
      await Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
      // Take control of open pages right away.
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  // 1) API data — always go to the network, never serve cached game data.
  if (request.url.includes('rapidapi')) {
    event.respondWith(fetch(request));
    return;
  }

  // 2) Navigations (the HTML document) — network-first, cache as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          return cached || caches.match('./index.html');
        }
      })()
    );
    return;
  }

  // 3) Other assets — network-first, fall back to cache when offline.
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error('Network error and no cached response');
      }
    })()
  );
});
