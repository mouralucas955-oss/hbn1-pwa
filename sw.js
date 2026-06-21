// ==========================================================================
// SERVICE WORKER — HBN1 PWA
// Cacheia o "app shell" (HTML/CSS/JS/ícones) para abrir rápido e permitir
// instalação no celular/desktop. Os DADOS (produtos, clientes, avisos)
// continuam vindo ao vivo da API/planilha — não são cacheados aqui,
// porque precisam estar sempre atualizados.
// ==========================================================================
const CACHE_NAME = 'hbn1-shell-v1';

const ARQUIVOS_PARA_CACHE = [
  './',
  './index.html',
  './catalogo.html',
  './api.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes.filter((nome) => nome !== CACHE_NAME).map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: "network first" para tudo, com fallback pro cache se ficar
// offline. Assim o app sempre tenta buscar a versão mais nova primeiro.
self.addEventListener('fetch', (event) => {
  // Nunca interceptar chamadas para a API do Apps Script — sempre direto na rede
  if (event.request.method !== 'GET' || event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((respostaRede) => {
        const copia = respostaRede.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respostaRede;
      })
      .catch(() => caches.match(event.request))
  );
});
