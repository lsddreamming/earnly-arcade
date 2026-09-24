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

    if (!document.querySelector('script[data-earnly-h5-ads]')) {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.earnlyH5Ads = '1';
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
        encodeURIComponent(ADSENSE_CLIENT);
      document.head.append(script);
    }
    return true;
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
            // The player already explicitly chose Earnly's "Watch ad → Play
            // Again" button, so immediately accept Google's reward offer.
            showAdFn();
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
