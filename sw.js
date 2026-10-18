// Offline fallback for the app shell. Network first, so a new deploy shows up on the next load;
// the cache only answers when the network is down or too slow.
const CACHE = 'truco-v1';
const NETWORK_TIMEOUT_MS = 3000;
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'analytics.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
const ASSET_URLS = new Set(ASSETS.map((path) => new URL(path, self.registration.scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function fetchWithTimeout(request) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS);
    }),
  ]);
}

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetchWithTimeout(request);
    if (response.ok) cache.put(cacheKey, response.clone());
    return response;
  } catch {
    return (await cache.match(cacheKey)) ?? fetch(request);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  const cacheKey = request.mode === 'navigate' ? new URL('./', self.registration.scope).href : url.href;
  if (request.mode !== 'navigate' && !ASSET_URLS.has(cacheKey)) return;
  event.respondWith(networkFirst(request, cacheKey));
});
