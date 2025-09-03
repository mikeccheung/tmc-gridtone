/* GridTone Service Worker
 * - Versioned caches to avoid old bundle conflicts
 * - Cleans up old caches on activate
 * - Stale-while-revalidate for fingerprinted assets
 * - Network-first for index.html to recover quickly after deploys
 */

const SW_VERSION = 'v4'; // bump this on each deploy that changes assets
const CACHE_PREFIX = 'gridtone-';
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${SW_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${SW_VERSION}`;

// List core files to pre-cache (optional; Vite will fingerprint assets)
// You can leave this empty and let runtime caching handle assets.
const CORE = [
  '/',            // ensure root loads when online
  '/index.html',  // HTML shell
];

// Utility: classify request type
function isHTML(req) {
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}
function isAsset(req) {
  const url = new URL(req.url);
  return /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(ASSET_CACHE);
    await cache.addAll(CORE).catch(() => {});
    // Activate this SW immediately
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => ![ASSET_CACHE, RUNTIME_CACHE].includes(n) && n.startsWith(CACHE_PREFIX))
        .map((n) => caches.delete(n))
    );
    // Take control of open clients
    await self.clients.claim();
  })());
});

// Message hook to trigger skipWaiting from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  // Network-first for HTML (helps avoid blank pages after deploys)
  if (isHTML(request)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch (err) {
        // Offline: serve last cached HTML if available
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request) || await caches.match('/index.html');
        return cached || new Response('<!doctype html><title>Offline</title><h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' }});
      }
    })());
    return;
  }

  // Stale-while-revalidate for static assets
  if (isAsset(request)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      const networkFetch = fetch(request).then((res) => {
        // Only cache successful responses
        if (res && res.status === 200) {
          cache.put(request, res.clone());
        }
        return res;
      }).catch(() => null);
      return cached || networkFetch || new Response(null, { status: 504 });
    })());
    return;
  }

  // Default: try network, fall back to cache
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch {
      const cached = await caches.match(request);
      return cached || new Response(null, { status: 504 });
    }
  })());
});
