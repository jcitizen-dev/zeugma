// Network-first with a cached fallback: always fresh when online, fully usable offline.
const CACHE = 'zeugma-v3';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/db.js',
  'js/state.js',
  'js/ui.js',
  'js/content.js',
  'js/maint.js',
  'js/data.js',
  'js/tablet.js',
  'js/guide.js',
  'js/views/home.js',
  'js/views/session.js',
  'js/views/log.js',
  'js/views/upkeep.js',
  'js/views/safety.js',
  'js/views/protocols.js',
  'js/views/settings.js',
  'js/views/guide.js',
  'vendor/chart.umd.min.js',
  'media/hero.jpg',
  'icons/favicon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Range requests (video seeking) go straight to the cache or network untouched.
  if (req.headers.has('range')) {
    e.respondWith(caches.match(req.url, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }
  e.respondWith(networkFirst(req, e));
});

async function networkFirst(req, e) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    if (res.ok) e.waitUntil(cache.put(req, res.clone()));
    return res;
  } catch {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && (await cache.match('index.html')));
    return hit || Response.error();
  }
}
