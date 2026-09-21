const CACHE_NAME = 'earnly-arcade-premium-v10';
const CORE_ASSETS = [
  './',
  './index.html',
  './games.html',
  './rewards.html',
  './profile.html',
  './account.html',
  './settings.html',
  './stats.html',
  './snake.html',
  './blockdrop.html',
  './taprush.html',
  './memory.html',
  './dodger.html',
  './brickbreaker.html',
  './junglehopper.html',
  './towerstack.html',
  './coincatch.html',
  './colormatch.html',
  './paddlerally.html',
  './lanerunner.html',
  './safecracker.html',
  './mini.html',
  './mini-games.js',
  './arcade.css',
  './premium.css',
  './arcade.js',
  './cloud.js',
  './manifest.webmanifest',
  './earnly-icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(CORE_ASSETS.map(async asset => {
        const url = new URL(asset, self.registration.scope).href;
        const response = await fetch(url, { cache:'reload' });
        if (response && response.ok) await cache.put(asset, response.clone());
      }))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache:'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('./index.html');
        })
    );
    return;
  }

  event.respondWith(
    fetch(request, { cache:'no-store' })
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
