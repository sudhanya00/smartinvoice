// Cache names
const CACHE_NAME = 'smartinvoice-v1';
const APP_SHELL_CACHE = 'app-shell-v1';
const MODEL_CACHE = 'model-cache-v1';

// Files to cache in the app shell
const appShellFiles = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/static/css/main.css',
  '/static/media/logo.svg',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Install the service worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(appShellFiles);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate and clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  
  const cacheWhitelist = [APP_SHELL_CACHE, MODEL_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Special handling for model files (ONNX)
  if (url.pathname.endsWith('.onnx')) {
    console.log('[Service Worker] Fetch model file', url);
    
    // For model files, try the cache first, then network
    event.respondWith(
      caches.open(MODEL_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[Service Worker] Using cached model');
            return cachedResponse;
          }
          
          console.log('[Service Worker] Fetching model from network');
          return fetch(event.request).then((networkResponse) => {
            // Cache the newly fetched model file
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }
  
  // For regular app files, use a standard cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        // Don't cache non-success responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Cache successful responses for app resources
        const responseToCache = response.clone();
        
        caches.open(APP_SHELL_CACHE).then((cache) => {
          if (event.request.url.includes('/static/')) {
            cache.put(event.request, responseToCache);
          }
        });
        
        return response;
      });
    })
  );
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});