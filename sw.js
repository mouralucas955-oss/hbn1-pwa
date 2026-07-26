/*
 * HBN1 — Service Worker seguro.
 *
 * Não armazena respostas da API, páginas autenticadas ou dados do catálogo.
 * A instalação também remove caches criados por versões antigas do PWA.
 */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.map(nome => caches.delete(nome))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requisicao = event.request;
  const url = new URL(requisicao.url);

  if (requisicao.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Rede pura: respeita Cache-Control: no-store do gateway e impede que um
  // cache antigo retenha respostas autenticadas.
  event.respondWith(fetch(requisicao));
});
