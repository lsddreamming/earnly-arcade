/* Home discovery covers the published Games catalog. Contract tests enforce parity. */
(() => {
  const catalog = [
  {
    "key": "neonSlice",
    "name": "Neon Slice",
    "href": "neon-slice.html",
    "icon": "🍔",
    "description": "Slice a cookout combo"
  },
  {
    "key": "bubblePop",
    "name": "Bubble Pop",
    "href": "bubble-pop.html",
    "icon": "🫧",
    "description": "Match bubbles. Clear a level."
  },
  {
    "key": "crystalCommand",
    "name": "Crystal Command",
    "href": "crystal-command.html",
    "icon": "◈",
    "description": "Build a base. Lead your army."
  },
  {
    "key": "neonBreach",
    "name": "Neon Breach",
    "href": "neonbreach.html",
    "icon": "🤖",
    "description": "Blast through robot waves"
  },
  {
    "key": "snake",
    "name": "Snake",
    "href": "snake.html",
    "icon": "🐍",
    "description": "Grow longer. Beat your best."
  },
  {
    "key": "blockDrop",
    "name": "Block Drop",
    "href": "blockdrop.html",
    "icon": "🧱",
    "description": "Stack blocks and clear lines"
  },
  {
    "key": "tapRush",
    "name": "Tap Rush",
    "href": "taprush.html",
    "icon": "🎯",
    "description": "Tap green before time runs out"
  },
  {
    "key": "memory",
    "name": "Memory Match",
    "href": "memory.html",
    "icon": "🧠",
    "description": "Find every matching pair"
  },
  {
    "key": "brickBreaker",
    "name": "Brick Breaker",
    "href": "brickbreaker.html",
    "icon": "💥",
    "description": "Break bricks. Keep the ball alive."
  },
  {
    "key": "jungleHopper",
    "name": "Jungle Hopper",
    "href": "junglehopper.html",
    "icon": "🐸",
    "description": "Hop through the jungle vines"
  },
  {
    "key": "towerStack",
    "name": "Tower Stack",
    "href": "towerstack.html",
    "icon": "🏗️",
    "description": "Time your taps. Build higher."
  },
  {
    "key": "coinCatch",
    "name": "Coin Catch",
    "href": "coincatch.html",
    "icon": "💰",
    "description": "Catch coins and build a combo"
  },
  {
    "key": "colorMatch",
    "name": "Color Match",
    "href": "colormatch.html",
    "icon": "🎨",
    "description": "Match the ink, not the word"
  },
  {
    "key": "paddleRally",
    "name": "Paddle Rally",
    "href": "paddlerally.html",
    "icon": "🏓",
    "description": "Keep your paddle rally going"
  },
  {
    "key": "laneRunner",
    "name": "Lane Runner",
    "href": "lanerunner.html",
    "icon": "🏎️",
    "description": "Switch lanes. Dodge traffic."
  },
  {
    "key": "safeCracker",
    "name": "Safe Cracker",
    "href": "safecracker.html",
    "icon": "🔐",
    "description": "Stop the marker in the safe zone"
  },
  {
    "key": "neonDrift",
    "name": "Neon Drift",
    "href": "neondrift.html",
    "icon": "🏁",
    "description": "Dodge traffic and chase Overdrive"
  },
  {
    "key": "mergeRush",
    "name": "Merge Rush",
    "href": "mini.html?game=mergeRush",
    "icon": "🔢",
    "description": "Swipe and merge bigger numbers"
  },
  {
    "key": "perfectDrop",
    "name": "Perfect Drop",
    "href": "mini.html?game=perfectDrop",
    "icon": "🎯",
    "description": "Time the perfect landing"
  },
  {
    "key": "spiralDrop",
    "name": "Spiral Drop",
    "href": "mini.html?game=spiralDrop",
    "icon": "🌀",
    "description": "Guide your ball through the gaps"
  },
  {
    "key": "shapeFit",
    "name": "Shape Fit",
    "href": "mini.html?game=shapeFit",
    "icon": "🧠",
    "description": "Find the matching silhouette"
  },
  {
    "key": "bounceRun",
    "name": "Bounce Run",
    "href": "mini.html?game=bounceRun",
    "icon": "⚪",
    "description": "Jump obstacles. Keep bouncing."
  },
  {
    "key": "trafficEscape",
    "name": "Traffic Escape",
    "href": "mini.html?game=trafficEscape",
    "icon": "🚦",
    "description": "Untangle the traffic jam"
  },
  {
    "key": "starDefender",
    "name": "Star Defender",
    "href": "stardefender.html?sd=20260925d",
    "icon": "👾",
    "description": "Defend against alien waves"
  },
  {
    "key": "neonMaze",
    "name": "Neon Maze",
    "href": "neonmaze.html",
    "icon": "⚡",
    "description": "Grab energy. Evade the drones."
  },
  {
    "key": "spuddyTurf",
    "name": "Spuddy Turf",
    "href": "spuddy-turf.html",
    "icon": "🗺️",
    "description": "Claim land and cut rival trails"
  },
  {
    "key": "harborGetaway",
    "name": "Harbor Getaway",
    "href": "harbor-getaway.html",
    "icon": "🌆",
    "description": "Explore the city and take jobs"
  },
  {
    "key": "spuddyEvolution",
    "name": "Spuddy Evolution",
    "href": "spuddy-evolution.html",
    "icon": "🌱",
    "description": "Gather seeds. Grow your Spuddy."
  },
  {"key":"bigFishEnergy","name":"BIG FISH ENERGY","href":"big-fish-energy.html","icon":"🦈","description":"Eat fish. Become an ocean giant."}
];

  // A persisted shuffle bag gives every title a turn before another cycle starts.
  function nextPair(items, saved, random = Math.random) {
    const ids = items.map(item => item.key);
    const signature = ids.slice().sort().join('|');
    const validIds = new Set(ids);
    const previous = Array.isArray(saved?.previous) ? saved.previous.filter(id => validIds.has(id)).slice(0, 2) : [];
    const queueValid = saved?.signature === signature && Array.isArray(saved.remaining) &&
      saved.remaining.every(id => validIds.has(id)) && new Set(saved.remaining).size === saved.remaining.length;
    let remaining = queueValid ? saved.remaining.slice() : [];
    const selected = [];
    while (selected.length < Math.min(2, ids.length)) {
      if (!remaining.length) {
        remaining = ids.slice();
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        // Do not repeat the just-shown pair at a cycle boundary.
        const avoid = new Set([...previous, ...selected]);
        remaining = [...remaining.filter(id => !avoid.has(id)), ...remaining.filter(id => avoid.has(id))];
      }
      const index = remaining.findIndex(id => !selected.includes(id));
      if (index < 0) break;
      selected.push(remaining.splice(index, 1)[0]);
    }
    return {selected, state:{signature, remaining, previous:selected}};
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {catalog, nextPair};
  if (typeof document === 'undefined') return;
  const grid = document.getElementById('homeFeaturedGames');
  const template = document.getElementById('homeGameChoices');
  if (!grid || !template) return;
  const existing = Array.from(template.content.querySelectorAll('a'));
  const storageKey = 'earnly.home.featured.queue.v2';
  let memoryState = null;
  const themes = ['slice','snake','jungle','breach'];
  const previewImages = {bigFishEnergy:'game-preview-big-fish-energy.webp',bubblePop:'game-preview-bubble-pop.webp',spuddyEvolution:'game-preview-spuddy-evolution.svg'};

  function makeCard(info) {
    const original = existing.find(card => card.getAttribute('href') === info.href);
    const card = original ? original.cloneNode(true) : document.createElement('a');
    card.dataset.game = info.key;
    if (original) return card;
    card.className = 'home-game-card home-game-' + themes[catalog.indexOf(info) % themes.length];
    card.href = info.href;
    const art = document.createElement('span');
    art.className = 'home-game-art';
    art.setAttribute('aria-hidden', 'true');
    if (previewImages[info.key]) {
      const img = document.createElement('img');
      img.src = previewImages[info.key]; img.alt = ''; img.width = 160; img.height = 100;
      img.addEventListener('error', () => { art.textContent = info.icon; }, {once:true});
      art.append(img);
    } else art.textContent = info.icon;
    const copy = document.createElement('span');
    copy.className = 'home-game-copy';
    const name = document.createElement('strong'); name.textContent = info.name;
    const description = document.createElement('small'); description.textContent = info.description;
    const play = document.createElement('b'); play.textContent = 'Play now ↗';
    copy.append(name, description, play); card.append(art, copy);
    return card;
  }

  function chooseGames(announce = false) {
    let saved = memoryState;
    try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null') || saved; } catch { /* Storage is optional. */ }
    const result = nextPair(catalog, saved);
    memoryState = result.state;
    const chosen = result.selected.map(id => catalog.find(info => info.key === id));
    grid.replaceChildren(...chosen.map(makeCard));
    try { localStorage.setItem(storageKey, JSON.stringify(memoryState)); } catch { /* Keep the in-memory queue. */ }
    if (announce) document.getElementById('homePicksStatus').textContent = 'Now showing ' + chosen.map(info => info.name).join(' and ');
  }

  chooseGames();
  const more = document.getElementById('homeMorePicks');
  if (more) { more.hidden = false; more.addEventListener('click', () => chooseGames(true)); }
  // Safari restores Home from its back-forward cache without rerunning this script.
  window.addEventListener('pageshow', event => { if (event.persisted) chooseGames(); });
})();
