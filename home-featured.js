(() => {
  const grid = document.getElementById('homeFeaturedGames');
  const template = document.getElementById('homeGameChoices');
  if (!grid || !template) return;
  const cards = Array.from(template.content.querySelectorAll('a'));
  const key = 'earnly.home.featured.previous.v1';
  let previous = [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) previous = saved.filter(value => typeof value === 'string');
  } catch { /* Home must remain playable when storage is unavailable. */ }

  function chooseGames() {
    let pool = cards.filter(card => !previous.includes(card.getAttribute('href')));
    if (pool.length < 2) pool = cards.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen = pool.slice(0, 2);
    grid.replaceChildren(...chosen.map(card => card.cloneNode(true)));
    previous = chosen.map(card => card.getAttribute('href'));
    try { sessionStorage.setItem(key, JSON.stringify(previous)); } catch { /* Optional. */ }
  }

  chooseGames();
  // Safari can restore Home without executing scripts again.
  window.addEventListener('pageshow', event => {
    if (event.persisted) chooseGames();
  });
})();
