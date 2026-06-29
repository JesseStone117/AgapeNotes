const BUILD_ID = 'development';
const CACHE_PREFIX = 'agapenotes-cache-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/styles/modal-extensions.css',
    '/styles/schedule.css',
    '/styles/index.css',
    '/styles/components.css',
    '/js/theme.js',
    '/js/history.js',
    '/js/apiClient.js',
    '/js/cryptoVault.js',
    '/js/pinAuth.js',
    '/js/storage.js',
    '/js/models.js',
    '/js/state.js',
    '/js/updater.js',
    '/js/components/dialog.js',
    '/js/components/modal.js',
    '/js/components/navigation.js',
    '/js/components/categoryTabs.js',
    '/js/components/personCard.js',
    '/js/components/personDetail.js',
    '/js/components/pinScreen.js',
    '/js/components/search.js',
    '/js/views/notesView.js',
    '/js/views/settingsView.js',
    '/js/views/resourcesView.js',
    '/js/views/scheduleView.js',
    '/js/views/meView.js',
    '/js/app.js',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg'
];

function freshRequest(url) {
    return new Request(url, { cache: 'reload' });
}

// Install event - cache this build's static assets
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching AgapeNotes build', BUILD_ID);
                return cache.addAll(STATIC_ASSETS.map(freshRequest));
            })
    );
});

// Activate event - remove old build caches and claim open tabs
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
                    .map((cacheName) => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

// Message handler - the app asks a waiting worker to activate immediately
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    if (requestUrl.pathname.startsWith('/api/')) return;

    // Honor explicit cache bypassing from the browser or developer tools
    if (event.request.cache === 'no-store' ||
        event.request.cache === 'no-cache' ||
        event.request.cache === 'reload') {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200) {
                            return response;
                        }

                        const responseToCache = response.clone();

                        event.waitUntil(
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(event.request, responseToCache))
                        );

                        return response;
                    })
                    .catch(() => {
                        // Offline fallback for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});
