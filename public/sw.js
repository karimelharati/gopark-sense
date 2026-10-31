// Never cache private API records or authenticated HTML.
self.addEventListener('install', event => { event.waitUntil(caches.open('gopark-offline-v3').then(cache => cache.add('/offline'))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => caches.match('/offline')));
});
