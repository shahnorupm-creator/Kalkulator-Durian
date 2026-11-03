const CACHE_VERSION = 'durian-fama-v5';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// All app pages to precache (only routes, not assets — assets cached on first load)
const PRECACHE_URLS = [
  '/',
  '/login',
  '/kalkulator',
  '/peta-negeri',
  '/dashboard-hq',
  '/laporan',
  '/profil',
  '/manifest.json',
];

// --- Install: Precache app shell (fail gracefully per-resource) ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      console.log('[SW] Precaching app shell');
      // Cache each individually — don't let one failure break all
      const results = await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url).then((response) => {
            if (response.ok) {
              return cache.put(url, response);
            }
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        console.warn('[SW] Some precache URLs failed:', failed.length);
      }
    })
  );
  self.skipWaiting();
});

// --- Activate: Clean old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// --- Fetch: Strategy-based caching ---
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // ONLY handle http/https — skip chrome-extension://, data:, etc.
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Firebase/Google API requests (Firestore handles its own offline)
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/')
  ) {
    return;
  }

  // Strategy 1: Cache-First for static assets (fonts, images, CSS, JS chunks)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy 2: Network-First for navigation (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Strategy 3: Stale-While-Revalidate for everything else
  event.respondWith(staleWhileRevalidate(request));
});

// --- Background Sync for pending data ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'firestore-sync') {
    console.log('[SW] Background sync triggered');
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'SYNC_AVAILABLE' });
      });
    });
  }
});

// --- Listen for messages from the app ---
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

// --- Caching Strategies ---

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline — serve from cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback: serve cached root for navigation
    const fallback = await caches.match('/');
    if (fallback) return fallback;

    return new Response(offlineHTML(), {
      headers: { 'Content-Type': 'text/html' },
      status: 503,
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, response.clone());
        });
      }
      return response;
    })
    .catch(() => cached);

  return cached || (await fetchPromise);
}

// --- Helpers ---

function isStaticAsset(url) {
  // Don't cache Next.js webpack chunks in development — they change every hot reload
  if (url.pathname.startsWith('/_next/static/chunks/webpack')) return false;
  const ext = url.pathname.split('.').pop();
  const staticExts = ['css', 'woff', 'woff2', 'ttf', 'otf', 'png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico'];
  return staticExts.includes(ext) || url.pathname.startsWith('/_next/static/');
}

function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - Kalkulator Durian FAMA</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #FAF7F0; color: #1F4D36; }
    .container { text-align: center; padding: 2rem; }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #666; font-size: 0.875rem; }
    button { margin-top: 1.5rem; padding: 0.75rem 2rem; background: #1F4D36; color: white; border: none; border-radius: 12px; font-size: 0.875rem; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>Anda sedang offline</h1>
    <p>Tiada sambungan internet. Data yang telah disimpan boleh diakses secara offline.</p>
    <button onclick="window.location.reload()">Cuba Semula</button>
  </div>
</body>
</html>`;
}
