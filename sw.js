/* Mind & Venture — lightweight PWA shell cache (assets load from network). */
const CACHE = 'mv-web-v96';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './assets/Awdjoo/Awdjoo.json',
  './assets/home baked sprites/material/MV2 tilesheet.png',
  './assets/home baked sprites/material/omniblock.png',
  './assets/home baked sprites/material/spawn spots.png',
  './js/save.js', './js/core.js', './js/audio.js', './js/enemies.js', './js/physics.js',
  './js/player.js', './js/weapons.js', './js/ui.js', './js/render.js',
  './js/editor.js', './js/spawn_fix.js', './js/awdjoo_level.js', './js/healthwatch.js',
  './js/awdjoo_map.js', './js/main.js',
  './js/selftest.js',
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

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).catch(() => {
      const u = new URL(e.request.url);
      if (u.pathname.includes('Awdjoo.json') || u.pathname.includes('testee')) {
        return new Response('Not found', { status: 404, statusText: 'Not Found' });
      }
      return caches.match(e.request);
    })
  );
});
