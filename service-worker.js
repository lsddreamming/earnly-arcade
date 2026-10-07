const CACHE_NAME = 'earnly-atelier-20261007';const CORE_ASSETS = [
  './coin-shop.js','./paid-plays.js','./cosmetic-adventure-pack.svg','./cosmetic-amber-goggles.svg','./cosmetic-arcade-cap.svg','./cosmetic-aurora-armor.svg','./cosmetic-aurora-pack.svg','./cosmetic-braided-beard.svg','./cosmetic-comet-sneakers.svg','./cosmetic-comms-headset.svg','./cosmetic-high-tops.svg','./cosmetic-no-headwear.svg','./cosmetic-orb-scepter.svg','./cosmetic-radiant-boots.svg','./cosmetic-ribbed-beanie.svg','./cosmetic-solar-jacket.svg','./cosmetic-storm-coat.svg','./cosmetic-sun-crown.svg',
  './cosmetic-canvas-pack.svg','./cosmetic-no-backpack.svg','./cosmetic-frost-beard.svg','./cosmetic-no-facewear.svg','./cosmetic-reactor-pack.svg','./cosmetic-neon-kicks.svg','./cosmetic-trail-boots.svg','./cosmetic-cozy-hoodie.svg','./cosmetic-round-glasses.svg','./cosmetic-canvas-shoes.svg','./cosmetic-no-beard.svg','./cosmetic-star-goggles.svg','./cosmetic-explorer-beard.svg','./cosmetic-sport-shades.svg','./cosmetic-short-beard.svg',
  './crystal-command.html', './crystal-command.css', './crystal-command.js', './crystal-command-engine.js', './crystal-command-renderer.js', './crystal-command-art.js', './crystal-command-network.js', './crystal-command-vendor.js',
  './compact-game-entry.css', './snake-ui.css',
  './',
  './index.html',
  './about.html',
  './game-guides.html',
  './public-info.css',
  './games.html',
  './rewards.html',
  './profile.html', './avatars.html', './avatar-studio.css', './avatar-studio.js', './avatar-config.js', './cosmetic-ui.css', './cosmetic-ui.js',
'./cosmetic-cyber-starter.svg','./cosmetic-astral-armor.svg','./cosmetic-starter-suit.svg','./cosmetic-neon-jacket.svg','./cosmetic-solar-cannon.svg','./cosmetic-vortex-mech.svg','./cosmetic-astra-prime.svg','./cosmetic-starter-blaster.svg','./cosmetic-neon-phantom.svg','./cosmetic-pulse-blade.svg',
  './leaderboards.html',
  './account.html',
  './settings.html',
  './stats.html',
  './support.html',
  './privacy.html',
  './terms.html',
  './snake.html',
  './blockdrop.html',
  './taprush.html',
  './memory.html',
  './dodger.html', './dodger-progression.js', './dodger-audio.js',
  './brickbreaker.html',
  './junglehopper.html',
  './towerstack.html',
  './coincatch.html',
  './colormatch.html',
  './paddlerally.html',
  './lanerunner.html',
  './safecracker.html',
  './mini.html',
  './stardefender.html',
  './neonmaze.html',
  './neondrift.html', './neondrift.css', './neondrift.js', './neondrift-engine.js', './neondrift-renderer.js', './neondrift-audio.js',
  './neonbreach.html', './neonbreach.css', './neonbreach.js', './neonbreach-engine.js', './neonbreach-art.js', './neonbreach-renderer.js', './neonbreach-audio.js', './neonbreach-voices.js',
  './mini-games.js', './mergerush-rules.js',
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
