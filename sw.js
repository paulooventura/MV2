/* Mind & Venture — cache static assets only; game JS always from network. */
const CACHE = 'mv-web-v145';
const SHELL = [
  './manifest.webmanifest',
  './assets/Awdjoo/Awdjoo.json',
  './assets/home baked sprites/material/MV2 tilesheet.png',
  './assets/home baked sprites/material/omniblock.png',
  './assets/home baked sprites/material/spawn spots.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache HTML or JS — mixed versions caused glitchy gameplay on deploy.
  if (url.pathname.endsWith('.html') || url.pathname.includes('/js/')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request))
  );
});
