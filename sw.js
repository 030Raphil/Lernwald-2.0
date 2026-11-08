// Lernwald offline helper. It keeps the newest version of the app and its fonts on the
// device, so Lernwald opens without internet. Online, the app is always fetched fresh
// first (for at most a few seconds), so new versions arrive at once.
// This file never needs to change; upload it once next to index.html.
const CACHE = 'lernwald-offline-1';
const HOME = new URL('./', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll([HOME, 'apple-touch-icon.png']).catch(() => cache.add(HOME)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts never change: from the device if there, else fetch once and keep.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // The app itself: the newest version from the internet; without internet (or if it
  // takes too long), the copy kept from the last visit.
  const page = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const key = page ? HOME : url.origin + url.pathname;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fresh = fetch(url.origin + url.pathname, { cache: 'no-cache' }).then((res) => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    });
    event.waitUntil(fresh.catch(() => {}));
    const slow = new Promise((resolve) => setTimeout(resolve, 4000));
    try {
      const res = await Promise.race([fresh, slow.then(() => null)]);
      if (res) return res;
    } catch (e) { /* offline */ }
    return (await cache.match(key)) || (await cache.match(HOME)) || fresh;
  })());
});
