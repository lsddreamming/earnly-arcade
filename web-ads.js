(() => {
  'use strict';

  // Add the approved AdSense H5 Games publisher ID here after Google approves
  // Earnly for H5 Games Ads. Until then the adapter stays disabled and the
  // website keeps using Earnly's existing demo rewarded flow.
  const ADSENSE_CLIENT = '';

  const isNativeRuntime = () => {
    try {
      if (window.Capacitor?.isNativePlatform?.()) return true;
    } catch {}
    return location.protocol === 'capacitor:' ||
      location.protocol === 'ionic:' ||
      !!window.EarnlyNativeAds?.isNative;
  };

  const configured = /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT);
  const enabled = configured && !isNativeRuntime();

  function installPlacementApi(){
    if (!enabled) return false;
    window.adsbygoogle = window.adsbygoogle || [];
    if (typeof window.adBreak !== 'function') {
      window.adBreak = function(options){ window.adsbygoogle.push(options); };
    }
    if (typeof window.adConfig !== 'function') {
      window.adConfig = function(options){ window.adsbygoogle.push(options); };
    }

    if (!window.__earnlyH5PreloadConfigured) {
      window.__earnlyH5PreloadConfigured = true;
      window.adConfig({ preloadAdBreaks:'on' });
    }

    if (!document.querySelector('script[data-earnly-h5-ads]')) {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.earnlyH5Ads = '1';
      script.dataset.adClient = ADSENSE_CLIENT;
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
        encodeURIComponent(ADSENSE_CLIENT);
      document.head.append(script);
    }
    return true;
  }

  function requestRewardConfirmation(showAdFn, decline){
    const existing = document.querySelector('dialog[data-earnly-h5-reward-confirm]');
    if (existing) existing.remove();

    const dialog = document.createElement('dialog');
    dialog.dataset.earnlyH5RewardConfirm = '1';
    dialog.className = 'earnly-h5-reward-confirm';
    dialog.innerHTML =
      '<h2>📺 Ad ready</h2>' +
      '<p>Watch this rewarded ad to unlock +1 play and jump straight back in.</p>';

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const watch = document.createElement('button');
    watch.type = 'button';
    watch.className = 'wide green';
    watch.textContent = 'Watch Ad → +1 Play';
    watch.addEventListener('click', () => {
      watch.disabled = true;
      cancel.disabled = true;
      // Google requires showAdFn() to be called from the direct user action.
      showAdFn();
      try { dialog.close(); } catch {}
      dialog.remove();
    });

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'wide secondary';
    cancel.textContent = 'Not Now';
    cancel.addEventListener('click', () => {
      try { dialog.close(); } catch {}
      dialog.remove();
      decline();
    });

    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      try { dialog.close(); } catch {}
      dialog.remove();
      decline();
    }, { once:true });

    actions.append(watch, cancel);
    dialog.append(actions);
    document.body.append(dialog);
    dialog.showModal();
  }

  function showRewarded(name = 'extra_play'){
    if (!enabled || !installPlacementApi()) {
      return Promise.resolve({ earned:false, unavailable:true, status:'not-configured' });
    }

    return new Promise(resolve => {
      let settled = false;
      const settle = result => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      };

      const timeout = setTimeout(() => {
        settle({ earned:false, unavailable:true, status:'timeout' });
      }, 60000);

      try {
        window.adBreak({
          type:'reward',
          name:String(name || 'extra_play').slice(0, 80),
          beforeReward:showAdFn => {
            requestRewardConfirmation(
              showAdFn,
              () => settle({ earned:false, dismissed:true, status:'declined' })
            );
          },
          adDismissed:() => settle({ earned:false, dismissed:true, status:'dismissed' }),
          adViewed:() => settle({ earned:true, status:'viewed' }),
          adBreakDone:placement => {
            const status = String(placement?.breakStatus || 'other');
            settle({
              earned:status === 'viewed',
              dismissed:status === 'dismissed',
              unavailable:!['viewed','dismissed'].includes(status),
              status
            });
          }
        });
      } catch (error) {
        settle({
          earned:false,
          unavailable:true,
          status:'error',
          message:String(error?.message || error)
        });
      }
    });
  }

  installPlacementApi();

  window.EarnlyWebAds = Object.freeze({
    enabled,
    configured,
    client:configured ? ADSENSE_CLIENT : '',
    showRewarded
  });

  window.dispatchEvent(new CustomEvent('earnly-web-ads-ready', {
    detail:{ enabled, configured }
  }));
})();
