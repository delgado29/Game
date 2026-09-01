/* Cafetal service worker: cache-first app shell so the game works offline once installed. */
const CACHE = 'cafetal-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './src/00_util.js', './src/01_i18n.js', './src/10_sprites.js', './src/20_audio.js', './src/30_world.js',
  './src/40_entities.js', './src/50_stations.js', './src/60_economy.js', './src/70_ui.js', './src/80_save.js', './src/90_main.js',
  './icons/icon-32.png', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
