// ==========================================================================
// SERVICE WORKER — HBN1 PWA v5
// Cache do app shell com versionamento automático
// ==========================================================================
const CACHE_NAME = 'hbn1-shell-v5';
const ARQUIVOS_PARA_CACHE = [
  './',
  './index.html',
  './catalogo.html',
  './negociacao.html',
  './catalogo-promotores.html',
  './catalogo.js',
  './catalogo.css',
  './api.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ARQUIVOS_PARA_CACHE))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(
        nomes.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});
// Network first → cache fallback (nunca intercepta chamadas à API nem CDNs externos)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('script.google.com')) return;
  if (event.request.url.includes('fonts.googleapis.com')) return;
  if (event.request.url.includes('fonts.gstatic.com')) return;
  if (event.request.url.includes('cdn.tailwindcss.com')) return;
  if (event.request.url.includes('cdnjs.cloudflare.com')) return;
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia));
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
