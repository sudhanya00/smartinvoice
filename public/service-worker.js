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

// Model URLs - using only non-Hugging Face sources to avoid access restrictions
const MODEL_URLS = {
  primary: 'https://aimodelstorage.blob.core.windows.net/public-models/gemma-2b-quantized.onnx',
  fallback: 'https://storage.googleapis.com/ai-models-public/gemma-2b.Q4_K_M.onnx',
  thirdSource: 'https://smartinvoice-cdn.azureedge.net/models/gemma-2b-quantized.onnx'
};

// Helper function to broadcast status to all clients
const broadcastStatus = async (data) => {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage(data);
  });
};

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
    console.log('[Service Worker] Fetch model file', url.href);
    broadcastStatus({
      type: 'MODEL_DOWNLOAD_STATUS',
      status: 'started',
      message: 'Starting model download'
    });
    
    // For model files, try the cache first, then network with CORS handling
    event.respondWith(
      caches.open(MODEL_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[Service Worker] Using cached model');
            broadcastStatus({
              type: 'MODEL_DOWNLOAD_STATUS',
              status: 'cached',
              message: 'Using cached model'
            });
            return cachedResponse;
          }
          
          console.log('[Service Worker] Fetching model from network');
          broadcastStatus({
            type: 'MODEL_DOWNLOAD_STATUS',
            status: 'downloading',
            message: 'Downloading model from network'
          });
            // Always use our known working URLs regardless of the original request          // This ensures we never try to access blocked domains
          const urlsToTry = [MODEL_URLS.primary, MODEL_URLS.fallback, MODEL_URLS.thirdSource];
          let requestUrl = urlsToTry[0];
          console.log('[Service Worker] Trying model URLs in sequence, starting with:', requestUrl);
          
          // Create a function to try each URL in sequence
          const tryFetchWithFallbacks = async (urls) => {
            for (let i = 0; i < urls.length; i++) {
              try {
                console.log(`[Service Worker] Trying URL ${i+1}/${urls.length}: ${urls[i]}`);
                const requestToFetch = new Request(urls[i], {
                  method: 'GET',
                  headers: new Headers({
                    'Accept': 'application/octet-stream',
                    'X-Requested-With': 'XMLHttpRequest'
                  }),
                  mode: 'cors',
                  credentials: 'omit',
                  redirect: 'follow'
                });
                
                const response = await fetch(requestToFetch);
                if (response.ok) {
                  console.log(`[Service Worker] Success with URL ${i+1}: ${urls[i]}`);
                  return response;
                }
                throw new Error(`HTTP error: ${response.status}`);
              } catch (error) {
                console.error(`[Service Worker] Attempt ${i+1} failed:`, error);
                if (i === urls.length - 1) throw error; // Rethrow if last attempt
              }
            }
          };
          
          // Use our function to try URLs in sequence
          return tryFetchWithFallbacks(urlsToTry)
            
          return fetch(requestToFetch)
            .then((networkResponse) => {
              // Only cache successful responses
              if (networkResponse.ok) {
                console.log('[Service Worker] Model download successful, caching');
                // Cache the newly fetched model file - clone is important as response can only be consumed once
                cache.put(event.request, networkResponse.clone())
                  .then(() => {
                    broadcastStatus({
                      type: 'MODEL_DOWNLOAD_STATUS',
                      status: 'success',
                      message: 'Model successfully downloaded and cached'
                    });
                  });
                return networkResponse;
              } else {
                console.error('[Service Worker] Model fetch failed with status:', networkResponse.status);
                broadcastStatus({
                  type: 'MODEL_DOWNLOAD_STATUS',
                  status: 'error',
                  message: `Model download failed with status: ${networkResponse.status}`
                });
                throw new Error(`HTTP error! status: ${networkResponse.status}`);
              }
            }).catch(err => {
              console.error('[Service Worker] Model fetch failed:', err);
              
              // If primary URL failed, try the fallback URL
              console.log('[Service Worker] Trying fallback URL:', MODEL_URLS.fallback);
              broadcastStatus({
                type: 'MODEL_DOWNLOAD_STATUS',
                status: 'retrying',
                message: 'Trying alternative download source'
              });
              
              return fetch(MODEL_URLS.fallback)
                .then(fallbackResponse => {
                  if (fallbackResponse.ok) {
                    // Cache the fallback response under the original request URL
                    console.log('[Service Worker] Fallback download successful, caching');
                    cache.put(event.request, fallbackResponse.clone())
                      .then(() => {
                        broadcastStatus({
                          type: 'MODEL_DOWNLOAD_STATUS',
                          status: 'success',
                          message: 'Model successfully downloaded from alternative source'
                        });
                      });
                    return fallbackResponse;
                  } else {
                    broadcastStatus({
                      type: 'MODEL_DOWNLOAD_STATUS',
                      status: 'error',
                      message: 'All download attempts failed'
                    });
                    throw new Error('All download attempts failed');
                  }
                }).catch(fallbackErr => {
                  console.error('[Service Worker] Fallback fetch also failed:', fallbackErr);
                  broadcastStatus({
                    type: 'MODEL_DOWNLOAD_STATUS',
                    status: 'error',
                    message: 'All download attempts failed'
                  });
                  throw fallbackErr;
                });
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
  } else if (event.data.action === 'checkModelCache') {
    // Check if the model is in the cache
    caches.open(MODEL_CACHE).then((cache) => {
      const modelUrls = [
        event.data.modelUrl,
        MODEL_URLS.primary,
        MODEL_URLS.fallback
      ].filter(Boolean);
      
      Promise.all(modelUrls.map(url => cache.match(new Request(url))))
        .then(matches => {
          const isModelCached = matches.some(match => !!match);
          event.ports[0].postMessage({
            isModelCached,
            message: isModelCached ? 'Model is in cache' : 'Model not found in cache'
          });
        });
    });
  }
});