const CACHE_NAME = 'scrabble-scorer-v1';
const urlsToCache = [
  '/',
  '/history.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/game-state.js',
  '/js/history.js',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If online, return the response and cache it if it's a GET request
          if (request.method === 'GET' && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If offline, try to serve from cache
          if (request.method === 'GET') {
            return caches.match(request).then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return a custom offline response for API calls
              return new Response(
                JSON.stringify({ 
                  error: 'Offline', 
                  message: 'This feature requires an internet connection' 
                }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
          }
          // For non-GET requests when offline, return error
          return new Response(
            JSON.stringify({ 
              error: 'Offline', 
              message: 'Cannot perform this action while offline' 
            }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise, fetch from network
        return fetch(request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Add to cache
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, return a fallback
        if (request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'background-sync-turns') {
    event.waitUntil(syncPendingTurns());
  }
});

// Sync pending turns when back online
async function syncPendingTurns() {
  try {
    // Get pending turns from IndexedDB or localStorage
    const pendingTurns = await getPendingTurns();
    
    for (const turn of pendingTurns) {
      try {
        const response = await fetch(`/api/games/${turn.gameId}/turns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(turn.data)
        });
        
        if (response.ok) {
          // Remove from pending turns
          await removePendingTurn(turn.id);
          console.log('Service Worker: Synced pending turn', turn.id);
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync turn', turn.id, error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

// Helper functions for managing pending turns
async function getPendingTurns() {
  // This would typically use IndexedDB
  // For now, return empty array
  return [];
}

async function removePendingTurn(turnId) {
  // This would typically remove from IndexedDB
  console.log('Service Worker: Would remove pending turn', turnId);
}

// Push notification handling (for future use)
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New game update available!',
    icon: '/manifest-icon-192.png',
    badge: '/manifest-icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Game',
        icon: '/images/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/images/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Scrabble Scorer', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
