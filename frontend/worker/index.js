// Custom service worker additions for next-pwa
// NOTE: Do NOT add install/activate handlers here — they conflict with
// workbox's lifecycle on Android Chrome. Page caching is handled by
// the NetworkFirst runtimeCaching rule in next.config.ts.

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
