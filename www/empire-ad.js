// The Capacitor build supplies native-ads.js. Browser play never requests it.
(() => {
  const offer = document.getElementById('investor');
  const cooldown = 15 * 60 * 1000;
  let loading = false;
  function grantSize() { return ticket() * 4; }
  function eligible() {
    return state.levels[1] < 50 && state.cash < price(1) &&
      Date.now() >= (state.nextInvestor || 0);
  }
  function update() {
    const available = window.EarnlyNativeAds?.isNative && eligible();
    offer.hidden = !loading && !available;
    offer.disabled = loading;
    offer.textContent = loading ? 'Loading investor ad…' :
      'Watch an ad for $' + fmt(grantSize()) + ' business cash';
  }
  offer.onclick = async () => {
    if (loading || !eligible() || !window.EarnlyNativeAds?.isNative) return;
    loading = true;
    const amount = grantSize();
    update();
    try {
      const result = await window.EarnlyNativeAds.showRewarded('extraPlays');
      if (result?.earned === true) {
        state.nextInvestor = Date.now() + cooldown;
        credit(amount);
        action('Investor delivered $' + fmt(amount) + ' business cash.');
      } else {
        document.getElementById('notice').textContent = 'No investor reward earned. You can keep serving customers.';
      }
    } catch {
      document.getElementById('notice').textContent = 'Ad unavailable. Keep serving or try again later.';
    } finally {
      loading = false;
      update();
    }
  };
  if (window.Capacitor?.isNativePlatform?.()) {
    if (!window.EarnlyNativeAds) {
      const bridge = document.createElement('script');
      bridge.src = 'native-ads.js';
      bridge.onload = update;
      document.head.append(bridge);
    }
    update();
    setInterval(update, 1000);
  }
})();
