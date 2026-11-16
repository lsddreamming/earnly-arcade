(() => {
  const $ = id => document.getElementById(id);
  const costs = { starter:50, deluxe:300 };
  const format = value => Number(value).toLocaleString('en-US');
  const art = {
    jax:['#f1ac68','#fa577a','✦'], mochi:['#efbb99','#b383fa','◒'],
    zippy:['#e9ab68','#75e394','ϟ'], blitz:['#efaf70','#65a9ff','◆'],
    'bubble-mochi':['#f1baaa','#ff93da','○'], 'tower-zippy':['#f2bd76','#7effdf','▥'],
    'neon-blitz':['#eeb179','#f4c760','▰']
  };
  let selected = 'starter';
  let state;
  let busy = false;
  let purchase;
  let dragStart;
  let audio;

  function cardView(card, note, missing = false) {
    const tile = document.createElement('figure');
    tile.className = 'spuddy-card' + (missing ? ' missing' : '');
    tile.dataset.rarity = card.rarity;
    const [skin, accent, mark] = art[card.id] || art.jax;
    const illustration = document.createElementNS('http://www.w3.org/2000/svg','svg');
    illustration.setAttribute('viewBox','0 0 180 153');
    illustration.setAttribute('aria-hidden','true');
    illustration.innerHTML = `<path d="M12 128 152 14M42 150 174 30M9 85 102 8" stroke="#fff" opacity=".16" stroke-width="5"/>
      <ellipse cx="90" cy="132" rx="55" ry="9" fill="#141228" opacity=".55"/>
      <path d="M44 95C37 61 62 35 91 33c36-3 56 24 52 57-3 25-22 41-54 40-22 0-40-11-45-35Z" fill="${skin}" stroke="#482735" stroke-width="4"/>
      <path d="M50 71q42-21 88-7l-4 20q-41-9-81 7Z" fill="${accent}"/>
      <path d="M68 97h1m34-2h1" stroke="#352337" stroke-width="8" stroke-linecap="round"/>
      <path d="M79 108q9 7 17-1" stroke="#613145" stroke-width="3" fill="none" stroke-linecap="round"/>
      <text x="125" y="48" font-size="31" fill="${accent}" stroke="#252042" stroke-width="1">${mark}</text>`;
    const caption = document.createElement('figcaption');
    const name = document.createElement('strong');
    name.textContent = card.title;
    const detail = document.createElement('small');
    detail.textContent = card.rarity + ' · ' + note;
    caption.append(name, detail);
    tile.append(illustration, caption);
    return tile;
  }

  function render() {
    const pending = state?.pending;
    $('vault-shop').hidden = !state || Boolean(pending);
    $('vault-opening').hidden = !pending;
    $('vault-balance').textContent = state ? format(state.balance) : '—';
    $('vault-rip').hidden = Boolean(pending?.card);
    $('vault-resolve').hidden = !pending?.card;
    $('vault-pull').replaceChildren();
    if (!state) {
      $('vault-binder').replaceChildren();
      $('vault-progress').textContent = 'Your collection syncs to your Earnly account.';
      return;
    }
    const cost = costs[selected];
    const insufficient = Number(state.balance) < cost;
    $('vault-buy').disabled = busy || insufficient;
    $('vault-buy').textContent = 'Buy for ' + cost + ' Arcade Coins';
    $('vault-topup').hidden = !insufficient;
    $('vault-weekly').hidden = !state.weeklyReady;
    $('vault-weekly').disabled = busy;
    $('vault-odds').replaceChildren(...state.catalog.filter(card => card[selected] > 0).map(card => {
      const row = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = card.title + ' · ' + card.rarity;
      const odds = document.createElement('strong');
      odds.textContent = card[selected] / 100 + '%';
      row.append(name, odds);
      return row;
    }));
    for (const button of document.querySelectorAll('[data-pack]')) {
      button.disabled = busy;
      button.setAttribute('aria-pressed', button.dataset.pack === selected);
    }
    $('vault-rip').disabled = $('vault-keep').disabled = $('vault-sell').disabled = busy;
    if (pending?.card) {
      const card = state.catalog.find(entry => entry.id === pending.card);
      const duplicate = Boolean(state.owned[card.id]);
      $('vault-pull').append(cardView(card, duplicate ? 'Duplicate' : 'First copy'));
      $('vault-sell').hidden = !duplicate;
      $('vault-sell').textContent = 'Sell duplicate for ' + format(pending.sellCoins) + ' coins';
    }
    $('vault-progress').textContent = Object.keys(state.owned).length + ' / ' + state.catalog.length + ' collected';
    $('vault-binder').replaceChildren(...state.catalog.map(card => {
      const copies = state.owned[card.id] || 0;
      return cardView(card, copies ? copies + ' owned' : 'Missing', !copies);
    }));
  }

  async function request(operation, id, pack) {
    if (busy || !window.EarnlyCloud?.ready) return;
    busy = true;
    render();
    $('vault-retry').hidden = true;
    $('vault-status').textContent = operation === 'status' ? 'Checking your Vault…' : 'Saving your pack…';
    try {
      const session = await EarnlyCloud.session();
      $('vault-signin').hidden = Boolean(session);
      if (!session) {
        state = undefined;
        $('vault-status').textContent = 'Sign in to see your cards and Arcade Coins.';
        return;
      }
      if (operation === 'status') {
        try { await EarnlyCloud.syncServerRewards(); } catch { /* Vault still reads the server wallet. */ }
      }
      const {data,error} = await EarnlyCloud.client.functions.invoke('activity', {
        body:{action:'spuddy_vault',operation,id,pack}
      });
      if (error || !data?.catalog) throw new Error('Vault unavailable');
      state = data;
      Arcade.applyServerWallet?.({balance:data.balance,lifetime_earned:data.lifetimeEarned});
      if (operation === 'buy') purchase = undefined;
      $('vault-status').textContent = data.error || ({buy:'Pack ready to rip.',reveal:'Your card is revealed.',
        vault:'Card saved to your Binder.',sell:'Sellback added to your Arcade Coins.'}[operation] || '');
    } catch {
      $('vault-status').textContent = 'Could not reach the Vault. Reconnect to check your saved pack and balance.';
      $('vault-retry').hidden = false;
    } finally {
      busy = false;
      render();
    }
  }

  function buy(pack) {
    if (busy || state?.pending) return;
    if (purchase?.pack !== pack) purchase = {pack,id:crypto.randomUUID()};
    void request('buy',purchase.id,pack);
  }

  function rip() {
    if (busy || !state?.pending || state.pending.card) return;
    const wrapper = $('vault-rip');
    wrapper.classList.add('ripping');
    try {
      const Engine = window.AudioContext || window.webkitAudioContext;
      if (Engine) {
        audio ||= new Engine();
        void audio.resume().catch(() => {});
        const size = Math.ceil(audio.sampleRate * .32);
        const buffer = audio.createBuffer(1,size,audio.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i=0;i<size;i++) samples[i] = (Math.random()*2-1) * (1-i/size) * .2;
        const source = audio.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.destination);
        source.start();
      }
    } catch { /* Audio is optional. */ }
    void request('reveal',state.pending.id).finally(() => wrapper.classList.remove('ripping'));
  }

  for (const button of document.querySelectorAll('[data-pack]')) button.addEventListener('click', () => {
    selected = button.dataset.pack;
    render();
  });
  $('vault-buy').addEventListener('click', () => buy(selected));
  $('vault-weekly').addEventListener('click', () => buy('weekly'));
  $('vault-rip').addEventListener('click', rip);
  $('vault-rip').addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    dragStart = {x:event.clientX,y:event.clientY,id:event.pointerId};
    event.currentTarget.setPointerCapture(event.pointerId);
  });
  $('vault-rip').addEventListener('pointerup', event => {
    if (dragStart?.id !== event.pointerId) return;
    const dx = Math.abs(event.clientX-dragStart.x);
    if (dx > 45 && dx > Math.abs(event.clientY-dragStart.y)) rip();
    dragStart = undefined;
  });
  $('vault-rip').addEventListener('pointercancel', () => { dragStart = undefined; });
  $('vault-keep').addEventListener('click', () => void request('vault',state?.pending?.id));
  $('vault-sell').addEventListener('click', () => void request('sell',state?.pending?.id));
  $('vault-retry').addEventListener('click', () => void request('status'));
  window.addEventListener('earnly-cloud-ready', () => void request('status'));
  window.addEventListener('earnly-cloud-auth-change', () => void request('status'));
  window.addEventListener('pageshow', () => void request('status'));
  if (window.EarnlyCloud?.ready) void request('status');
})();
