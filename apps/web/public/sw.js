// IF-02, SDD section 9 (PWA): caches the app shell and recently played audio. No offline study:
// API calls are never cached, so progress always comes from the server.
const SHELL = 'shell-v1';
const AUDIO = 'audio-v1';
const AUDIO_LIMIT = 50;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add('/'))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL, AUDIO];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') && request.destination !== 'audio') return;

  if (request.destination === 'audio') {
    event.respondWith(cacheFirst(request, AUDIO, AUDIO_LIMIT));
  } else if (request.mode === 'navigate') {
    // Network first so a new deploy shows at once; the cached shell only covers a failed network.
    event.respondWith(
      fetch(request).catch(() => caches.match('/').then((r) => r ?? Response.error())),
    );
  } else if (url.pathname.startsWith('/assets/')) {
    // Hashed file names never change, so cache them forever.
    event.respondWith(cacheFirst(request, SHELL));
  }
});

async function cacheFirst(request, name, limit) {
  const cache = await caches.open(name);
  const hit = await cache.match(request, { ignoreSearch: false });
  if (hit) return hit;
  const response = await fetch(request);
  // 206 (range) responses cannot be cached.
  if (response.status === 200) {
    await cache.put(request, response.clone());
    if (limit) {
      const keys = await cache.keys();
      await Promise.all(
        keys.slice(0, Math.max(0, keys.length - limit)).map((k) => cache.delete(k)),
      );
    }
  }
  return response;
}
