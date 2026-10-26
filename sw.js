/* Mind & Venture — never keep an old page.
   HTML and JS always come from the network. When this file changes, open
   tabs reload onto the new build. The page registers this against its own
   URL, not the <base> tag (that used to request /claude/sw.js, which 404s). */
const BUILD = '306';

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) c.postMessage({ type: 'mv-build', build: BUILD });
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;
  const nav = e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  const code = url.pathname.endsWith('.js') || url.pathname.endsWith('/build.txt');
  if (nav || code) e.respondWith(fetch(e.request, { cache: 'no-store' }));
});
