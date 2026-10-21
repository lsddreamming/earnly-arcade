(() => {
  const native = window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === 'ios';
  if (!native) return;
  const section = document.getElementById('adPrivacyOptions');
  const button = document.getElementById('adPrivacyButton');
  const status = document.getElementById('adPrivacyStatus');
  section.hidden = false;
  let bridgePromise;
  function loadBridge() {
    if (window.EarnlyNativeAds) return Promise.resolve(window.EarnlyNativeAds);
    if (!bridgePromise) bridgePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'native-ads.js';
      script.onload = () => window.EarnlyNativeAds ? resolve(window.EarnlyNativeAds) : reject(new Error('Bridge unavailable'));
      script.onerror = () => { script.remove(); reject(new Error('Bridge unavailable')); };
      document.head.append(script);
    }).catch(error => { bridgePromise = null; throw error; });
    return bridgePromise;
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Loading privacy choices…';
    try {
      const ads = await loadBridge();
      const result = await ads.showPrivacyOptions();
      status.textContent = result.shown ? 'Your privacy choices have been updated.' : 'Google has no additional ad privacy choices available for this device right now.';
    } catch {
      status.textContent = 'Privacy choices could not load. Check your connection and try again.';
    } finally {
      button.disabled = false;
    }
  });
})();
