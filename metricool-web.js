// Public website acquisition analytics; never runs in the native app or private screens.
(function () {
  'use strict';
  try {
    if (location.protocol !== 'https:' || location.hostname !== 'earnlyarcade.com') return;
    if (window.Capacitor?.isNativePlatform?.()) return;
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
    if (!/^\/(?:www\/)?(?:index\.html|games\.html|neon-slice\.html|neon-breach\.html)?$/.test(location.pathname)) return;
    // Avoid forwarding authentication fragments or arbitrary query values to third parties.
    if (location.hash || [...new URLSearchParams(location.search).keys()].some(key => !/^utm_(source|medium|campaign|content|term)$/.test(key) && key !== 'challenge')) return;
    if (window.__earnlyMetricoolLoaded) return;
    window.__earnlyMetricoolLoaded = true;
    const script = document.createElement('script');
    script.src = 'https://tracker.metricool.com/resources/be.js';
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.onload = function () {
      try { window.beTracker?.t({hash: '7c611c029c252de8eb92fecc41673186'}); } catch (_) {}
    };
    document.head.appendChild(script);
  } catch (_) { /* Analytics must never interrupt play. */ }
})();
