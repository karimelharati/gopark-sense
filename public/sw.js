// Cache a generic wallet shell; private receipts and observations use explicit IndexedDB storage.
self.addEventListener('install', event => { event.waitUntil(caches.open('gopark-offline-v4').then(cache => cache.addAll(['/offline','/offline-wallet','/offline-wallet.js','/offline-wallet.css','/favicon.svg']))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  const pathname=new URL(event.request.url).pathname;
  if(event.request.method!=='GET'||pathname.startsWith('/api/'))return;
  if(['/offline-wallet.js','/offline-wallet.css','/favicon.svg'].includes(pathname))event.respondWith(fetch(event.request).catch(()=>caches.match(pathname)));
  else if (event.request.mode === 'navigate') event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(pathname.startsWith('/offline-wallet')?'/offline-wallet':'/offline')));
});
