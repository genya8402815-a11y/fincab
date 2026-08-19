const STATIC_CACHE = 'fincab-static-v2';
const API_CACHE    = 'fincab-api-v2';
const PAGE_CACHE   = 'fincab-pages-v2';
const ALL_CACHES   = [STATIC_CACHE, API_CACHE, PAGE_CACHE];

// ── Установка: кешируем shell ────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PAGE_CACHE)
      .then(c => c.addAll(['/', '/manifest.json', '/favicon.ico']))
      .then(() => self.skipWaiting())
  );
});

// ── Активация: удаляем старые кеши ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch стратегии ──────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return; // POST/DELETE/PATCH идут напрямую

  const url = new URL(request.url);

  // /_next/static/ — cache-first (файлы хешированы, не меняются)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(hit =>
        hit || fetch(request).then(resp => {
          if (resp.ok) caches.open(STATIC_CACHE).then(c => c.put(request, resp.clone()));
          return resp;
        })
      )
    );
    return;
  }

  // /api/ — network-first, сохраняем успешный ответ в кеш
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(resp => {
          if (resp.ok) caches.open(API_CACHE).then(c => c.put(request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(request).then(hit => hit || Response.error()))
    );
    return;
  }

  // Всё остальное (страницы, шрифты и т.д.) — network-first с fallback
  event.respondWith(
    fetch(request)
      .then(resp => {
        if (resp.ok) caches.open(PAGE_CACHE).then(c => c.put(request, resp.clone()));
        return resp;
      })
      .catch(() => caches.match(request))
  );
});

// ── Push-уведомления ─────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FinCab', {
      body: data.body ?? '',
      icon: '/favicon.ico',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
