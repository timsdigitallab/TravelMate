// App-shell service worker. Only static assets are cached here - IndexedDB
// (where all trip data lives) is a completely separate storage API that
// this file never touches, so cache cleanup below can never delete user data.
//
// WHEN YOU ADD A NEW .js/.css/.html FILE: add its path to PRECACHE_URLS
// below AND bump CACHE_NAME, or offline users won't get it.
const CACHE_NAME = 'travelmate-shell-v8';

// Pinned Firebase SDK modules loaded from the CDN by js/auth.js and js/db.js.
// Bump the version here whenever those imports' pins change, and keep this
// list in sync with what's imported.
const FIREBASE_SDK_PREFIX = 'https://www.gstatic.com/firebasejs/';
const FIREBASE_SDK_URLS = [
  'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js',
];

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './CHANGELOG.md',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/fonts.css',
  './fonts/Mulish-400.woff2',
  './fonts/Mulish-500.woff2',
  './fonts/Mulish-600.woff2',
  './fonts/Mulish-700.woff2',
  './fonts/Spectral-600.woff2',
  './fonts/Spectral-700.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/app.js',
  './js/router.js',
  './js/utils/icons.js',
  './js/db.js',
  './js/schema.js',
  './js/state.js',
  './js/version.js',
  './js/utils/id.js',
  './js/utils/date.js',
  './js/utils/currency.js',
  './js/utils/files.js',
  './js/utils/ics.js',
  './js/utils/export-import.js',
  './js/utils/maps.js',
  './js/components/form-fields.js',
  './js/components/modal.js',
  './js/components/list-item.js',
  './js/components/crud-view.js',
  './js/components/document-picker.js',
  './js/views/dashboard.js',
  './js/views/trip.js',
  './js/views/places.js',
  './js/views/budget.js',
  './js/views/visa.js',
  './js/views/jobs.js',
  './js/views/packing.js',
  './js/views/contacts.js',
  './js/views/documents.js',
  './js/views/settings.js',
  './js/views/login.js',
  './js/auth.js',
  './js/firebase-config.js',
  './js/utils/legacy-migration.js',
];

// Precache with an explicit network fetch per file, bypassing the browser's
// regular HTTP cache (cache.addAll()'s default fetch can silently reuse a
// stale HTTP-cached response - e.g. from a visit before this release was
// deployed - and bake it into the SW's own cache, which then serves that
// staleness offline indefinitely even after CACHE_NAME is bumped).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        [...PRECACHE_URLS, ...FIREBASE_SDK_URLS].map((url) =>
          fetch(new Request(url, { cache: 'reload' })).then((response) => cache.put(url, response))
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Stale-while-revalidate: serve from cache instantly (works offline),
// refetch in the background to keep the cache warm for next time.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isPinnedFirebaseSdk = event.request.url.startsWith(FIREBASE_SDK_PREFIX);
  if (url.origin !== location.origin && !isPinnedFirebaseSdk) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
