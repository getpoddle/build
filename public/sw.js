// This service worker immediately clears all caches and unregisters itself
// to ensure users always get the latest version of the app.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => self.registration.unregister())
  );
});
