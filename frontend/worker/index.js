// Custom service worker additions for next-pwa
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
