const CACHE_NAME = 'europos-static-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorar métodos distintos a GET (POST de Server Actions), rutas de API/Supabase y HMR
  if (
    req.method !== 'GET' ||
    req.headers.has('Next-Action') ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/realtime/v1/')
  ) {
    return;
  }

  event.respondWith(
    fetch(req).catch(async () => {
      const cached = await caches.match(req);
      return (
        cached ||
        new Response('Sin conexión', {
          status: 503,
          statusText: 'Offline',
        })
      );
    })
  );
});
