importScripts('version.js');
const C = 'accordeur-' + APP_VERSION;
const F = ['./', 'index.html', 'pitch.js', 'version.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(F))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
// Réseau d'abord (toujours la dernière version si on est en ligne, 3 s max), cache en secours (hors ligne).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(C);
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 3000);
      const res = await fetch(e.request, { signal: ctl.signal, cache: 'no-cache' });
      clearTimeout(t);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (_) {
      return (await cache.match(e.request, { ignoreSearch: true })) || (await cache.match('index.html'));
    }
  })());
});
