// The Capacitor build supplies native-ads.js. Browser play never requests it.
(() => {
  const investor = $('#investor'), boost = $('#boost'), double = $('#offline-double'), reopen = $('#offline-reopen');
  const cooldown = 15 * 60 * 1000;
  let busy = '';
  const native = () => window.EarnlyNativeAds?.isNative === true;
  const grantSize = () => ticket() * 4;
  const eligible = () => state.levels[1] < 50 && state.cash < price(1) && Date.now() >= state.nextInvestor;
  function remaining() {
    const seconds = Math.max(0, Math.ceil((state.boostUntil - Date.now()) / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }
  function update() {
    const available = native(), active = boostActive(), pending = state.offlineOffer;
    investor.hidden = !available || (!eligible() && busy !== 'investor');
    investor.disabled = !!busy;
    investor.textContent = busy === 'investor' ? 'Loading investor ad…' :
      'Watch an ad for $' + fmt(grantSize()) + ' business cash';
    boost.hidden = !available;
    boost.disabled = !!busy || active;
    boost.textContent = busy === 'boost' ? 'Loading profit ad…' : active ?
      '2× profits active · ' + remaining() : 'Watch an ad · 2× profits for 10 min';
    double.hidden = !available || !pending;
    double.disabled = !!busy;
    double.textContent = pending ? 'Watch an ad · double earnings (+$' + fmt(pending.amount) + ')' : '';
    reopen.hidden = !available || !pending || $('dialog').open;
    reopen.disabled = !!busy;
  }
  async function request(kind) {
    if (busy || !native()) return;
    if (kind === 'investor' && !eligible() || kind === 'boost' && boostActive() || kind === 'offline' && !state.offlineOffer) return;
    if (!save()) return; // No ad if the reward cannot be persisted.
    const amount = kind === 'investor' ? grantSize() : 0;
    const snapshot = kind === 'offline' ? {...state.offlineOffer} : null;
    busy = kind;
    if (snapshot) {
      offlineClaimInFlight = true;
      // The base payout is already credited; players can continue while the ad loads.
      if ($('dialog').open) $('dialog').close();
    }
    update();
    try {
      // Reuse the existing native rewarded placement (no Arcade Coins or extra plays are granted here).
      const result = await window.EarnlyNativeAds.showRewarded('extraPlays');
      if (result?.earned !== true) {
        $('#notice').textContent = 'No ad reward earned. Keep playing or try again.';
        return;
      }
      let granted = false, message = '';
      if (kind === 'investor') {
        granted = commitReward(() => {
          if (Date.now() < state.nextInvestor) return false;
          state.nextInvestor = Date.now() + cooldown;
          credit(amount);
          return true;
        });
        message = 'Investor delivered $' + fmt(amount) + ' business cash.';
      } else if (kind === 'boost') {
        granted = beginProfitBoost();
        message = '2× operating profits active for 10 minutes!';
      } else {
        granted = claimOfflineBonus(snapshot);
        message = 'Offline earnings doubled! +$' + fmt(snapshot.amount) + ' business cash.';
      }
      if (granted) {
        action(message);
        if (kind === 'offline' && $('dialog').open && !state.offlineOffer) $('dialog').close();
      } else {
        $('#notice').textContent = 'Ad reward could not be saved or was already claimed.';
      }
    } catch {
      $('#notice').textContent = 'Ad unavailable. Keep playing or try again later.';
    } finally {
      offlineClaimInFlight = false;
      busy = '';
      update();
    }
  }
  investor.onclick = () => request('investor');
  boost.onclick = () => request('boost');
  double.onclick = () => request('offline');
  reopen.onclick = () => { if (!busy && native()) { presentOffline(); update(); } };
  $('dialog').addEventListener('close', update);
  window.addEventListener('earnly-native-ads-ready', update);
  if (window.Capacitor?.isNativePlatform?.() && !window.EarnlyNativeAds) {
    const bridge = document.createElement('script');
    bridge.src = 'native-ads.js';
    bridge.onload = update;
    document.head.append(bridge);
  }
  update();
  setInterval(update, 1000);
})();
