(() => {
  'use strict';
  const native = window.Capacitor?.isNativePlatform?.() || window.Arcade?.installStatus?.().native;
  if (native) {
    document.querySelectorAll('.app-download-card').forEach(card => { card.hidden = true; });
    return;
  }
  // Preserve navigation even when storage, analytics, or the network is unavailable.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[data-growth-action]');
    if (!link) return;
    try {
      if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
      window.Arcade?.trackEvent?.('promotion_clicked', {
        game: link.dataset.growthGame || null,
        landingPath: location.pathname.split('/').pop() || 'index.html',
        stage: link.dataset.growthAction,
        reason: link.dataset.growthPlacement || 'promotion'
      });
      window.EarnlyCloud?.syncGrowthEvents?.()?.catch?.(() => {});
    } catch (_) { /* A download or game link must always work. */ }
  });
})();
