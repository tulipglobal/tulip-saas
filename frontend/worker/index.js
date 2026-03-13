// Custom service worker additions for next-pwa

// Precache critical navigation pages on SW install
// This ensures Safari standalone PWA can open offline
const PRECACHE_PAGES = [
  '/dashboard',
  '/dashboard/expenses',
  '/dashboard/expenses/new',
  '/login',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('pages').then((cache) =>
      Promise.all(
        PRECACHE_PAGES.map((url) =>
          fetch(url)
            .then((res) => {
              if (res.ok) return cache.put(url, res);
            })
            .catch(() => {})
        )
      )
    )
  );
});

// Also re-cache pages on activate (handles SW updates)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open('pages').then((cache) =>
      Promise.all(
        PRECACHE_PAGES.map((url) =>
          fetch(url)
            .then((res) => {
              if (res.ok) return cache.put(url, res);
            })
            .catch(() => {})
        )
      )
    )
  );
});

// Background sync handler for offline expense queue
self.addEventListener('sync', (event) => {
  if (event.tag === 'expense-sync') {
    // Notify all open clients to drain the sync queue
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'BACKGROUND_SYNC' }));
      })
    );
  }
});
