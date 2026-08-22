const CACHE_NAME = 'citalink-v4';

// NO pre-cachear index.html — siempre network-first para obtener HTML fresco post-deploy
const PRECACHE_URLS = [];

// Instalar: skipWaiting inmediato (no precache de HTML)
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando CitaLink v4...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_URLS);
        }).then(() => self.skipWaiting())
    );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando v4...');
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: Network-first para navegación, Cache-first para assets estáticos
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorar peticiones a Supabase (siempre red)
    if (url.hostname.includes('supabase')) {
        return;
    }

    // Assets estáticos → Cache first (imágenes, fuentes, /assets/)
    if (request.destination === 'image' || request.destination === 'font' || url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                return cached || fetch(request).then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // Navegación → SIEMPRE Network first (obtener HTML fresco post-deploy)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cachear la respuesta exitosa para fallback offline
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Resto → pass-through
    event.respondWith(fetch(request));
});
