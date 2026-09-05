const CACHE_NAME = 'moadja-cache-v1.69.3';

const ASSETS_TO_CACHE = [
    '/css/style.css',
    '/css/feed.css',
    '/css/sante.css',
    '/css/cycle.css',
    '/css/taches.css',
    '/css/meteo.css',
    '/css/priere.css',
    '/css/islam.css',
    '/css/profil.css',
    '/css/agenda.css',
    '/css/theme-astral.css',
    '/css/tchat.css',
    '/js/app.js',
    '/js/widgets.js',
    '/js/modal.js',
    '/js/profil.js',
    '/js/agenda.js',
    '/js/meteo.js',
    '/js/cycle.js',
    '/js/taches.js',
    '/js/anniversaires.js',
    '/js/priere.js',
    '/js/islam.js',
    '/js/push.js',
    '/js/admin.js',
    '/js/astrologie.js',
    '/js/feed.js',
    '/js/social.js',
    '/js/sante.js',
    '/js/changelog.js',
    '/js/theme-astral.js',
    '/js/eclats.js',
    '/js/tchat.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', event => {
    if (event.request.url.startsWith('chrome-extension')) return;
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    if (url.pathname.startsWith('/api/')) return;
    if (url.pathname.startsWith('/socket.io/')) return;

    const networkFirst = [
        '/',
        '/index.html',
        '/css/style.css',
        '/css/feed.css',
        '/css/sante.css',
        '/css/cycle.css',
        '/css/taches.css',
        '/css/meteo.css',
        '/css/priere.css',
        '/css/islam.css',
        '/css/profil.css',
        '/css/agenda.css',
        '/css/theme-astral.css',
        '/css/tchat.css'
    ];

    if (networkFirst.includes(url.pathname)) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request).then(cached => cached || new Response('', { status: 503 })))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            const fetchPromise = fetch(event.request).then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
            return cached || fetchPromise;
        })
    );
});

self.addEventListener('push', event => {
    let data = {};
    try { data = event.data.json(); } catch {}
    event.waitUntil(
        self.registration.showNotification(data.titre || 'MoaDja', {
            body  : data.corps || '',
            icon  : '/icon-192.png',
            badge : '/icon-192.png',
            data  : { url: data.url || '/' },
            tag   : data.tag || 'moadja'
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url === event.notification.data.url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(event.notification.data.url);
        })
    );
});
