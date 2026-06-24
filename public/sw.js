/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const CACHE_NAME = 'dzstore-pwa-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[PWA ServiceWorker] Pre-caching critical application hulls...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[PWA ServiceWorker] Removing outdated cache container: ', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Strict filters to bypass API calls, database snapshots, socket lines, and non-GET items
  if (
    request.method !== 'GET' ||
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('firebase') ||
    url.origin.includes('identitytoolkit') ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('socket') ||
    url.pathname.includes('version.json') ||
    url.hostname === 'localhost'
  ) {
    return; // Pass through to network-only
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-While-Revalidate: Return instant cache response and trigger asynchronous fetch in background
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {}); // Suppress background fetch failures when completely offline
        
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch((err) => {
          // Serve static routing index map if the navigational route is not available raw
          if (request.mode === 'navigate') {
            return caches.match('/index.html') || new Response("Offline mode active.");
          }
          throw err;
        });
    })
  );
});
