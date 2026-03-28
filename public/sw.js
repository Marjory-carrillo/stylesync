const CACHE_NAME = 'citalink-v1';

// Recursos esenciales a cachear en la instalación
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/assets/icon-192.png',
    '/assets/icon-512.png',
    '/manifest.json'
];

// Instalar: precachear recursos estáticos
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando CitaLink v1...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_URLS);
        }).then(() => self.skipWaiting())
    );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando...');
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: Network-first para API, Cache-first para assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorar peticiones a Supabase (siempre red)
    if (url.hostname.includes('supabase')) {
        return;
    }

    // Assets estáticos → Cache first
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

    // Navegación → Network first, fallback a cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Resto → pass-through
    event.respondWith(fetch(request));
});
