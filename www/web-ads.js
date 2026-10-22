/* Google H5 rewarded ads. Release gate stays off until account + consent review. */
(() => {
  'use strict';
  const ENABLED = false;
  const TEST_MODE = false;
  const native = () => !!window.Capacitor?.isNativePlatform?.() || !!window.EarnlyNativeAds?.isNative || !/^https?:$/.test(location.protocol);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const enabled = ENABLED && !native() && (!TEST_MODE || local);
  let ready = null, active = false, generation = 0;
  const invalidate = () => { generation++; };
  window.addEventListener('earnly-cloud-auth-change', invalidate);
  window.addEventListener('pagehide', invalidate);

  function initialize() {
    if (ready) return ready;
    ready = new Promise(resolve => {
      let settled = false;
      const finish = ok => { if (!settled) { settled = true; clearTimeout(timer); resolve(ok); } };
      const timer = setTimeout(() => finish(false), 10000);
      window.adsbygoogle = window.adsbygoogle || [];
      // Reuse the site's publisher tag; never load a second copy.
      let script = document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
      if (script && (script.getAttribute('data-adbreak-test') === 'on') !== TEST_MODE) { finish(false); return; }
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8864401806510610';
        script.crossOrigin = 'anonymous';script.async = true;
        if (TEST_MODE) script.setAttribute('data-adbreak-test', 'on');
        script.addEventListener('error', () => finish(false), {once:true});
        document.head.append(script);
      }
      window.adsbygoogle.push({preloadAdBreaks:'on', sound:'off', onReady:() => finish(true)});
    });
    return ready;
  }

  function showRewarded(kind = 'extraPlays') {
    if (!enabled || native()) return Promise.resolve({earned:false, reason:'not-enabled'});
    if (!['extraPlays', 'continue'].includes(kind)) return Promise.resolve({earned:false, reason:'unsupported-placement'});
    if (active) return Promise.resolve({earned:false, reason:'busy'});
    active = true;
    const account = generation;
    return new Promise(resolve => {
      let settled = false, viewed = false, shown = false, timer, prompt;
      const finish = reason => {
        if (settled) return;
        settled = true; clearTimeout(timer); prompt?.remove(); active = shown && reason === 'timeout';
        window.dispatchEvent(new CustomEvent('earnly-web-ad-ended'));
        resolve({earned:viewed && shown && generation === account && reason === 'done', reason, testMode:TEST_MODE, provider:'google-h5'});
      };
      const arm = delay => { clearTimeout(timer); timer = setTimeout(() => finish('timeout'), delay); };
      arm(15000);
      initialize().then(ok => {
        if (settled) return;
        if (!ok || account !== generation) { finish('unavailable'); return; }
        window.adsbygoogle.push({
          type:'reward', name:kind === 'continue' ? 'earnly_extra_life' : 'earnly_extra_play',
          beforeReward: showAd => {
            if (settled || prompt || account !== generation) return;
            arm(120000);
            prompt = document.createElement('dialog');
            prompt.setAttribute('aria-label', 'Optional video reward');
            prompt.style.cssText = 'box-sizing:border-box;max-width:calc(100vw - 32px);width:360px;padding:24px;border:1px solid #59e9ed;border-radius:18px;background:#102338;color:#fff;font:16px system-ui;';
            const title = document.createElement('h2');title.textContent = kind === 'continue' ? 'Keep your run going' : 'One more play';
            const copy = document.createElement('p');copy.textContent = kind === 'continue' ? 'Watch this ad to continue your current run.' : 'Watch this ad to get +1 play for this game.';
            const watch = document.createElement('button');watch.textContent = TEST_MODE ? 'Watch test ad' : 'Watch ad';
            const cancel = document.createElement('button');cancel.textContent = 'Not now';
            for (const button of [watch, cancel]) button.style.cssText = 'min-height:48px;padding:12px 18px;margin:6px;border-radius:10px;font:inherit;cursor:pointer;';
            watch.onclick = () => {
              if (settled || shown) return;
              if (account !== generation) { finish('account-changed'); return; }
              shown = true;prompt.close();prompt.remove();arm(180000);
              try { showAd(); } catch { finish('error'); }
            };
            cancel.onclick = () => finish('declined');
            prompt.oncancel = e => { e.preventDefault();finish('declined'); };
            prompt.append(title, copy, watch, cancel);document.body.append(prompt);prompt.showModal();
          },
          beforeAd: () => { if (!settled) window.dispatchEvent(new CustomEvent('earnly-web-ad-started')); },
          afterAd: () => { if (!settled) window.dispatchEvent(new CustomEvent('earnly-web-ad-ended')); },
          adViewed: () => { if (!settled && shown) viewed = true; },
          adDismissed: () => { viewed = false; },
          adBreakDone: () => { if (settled) { active = false; return; } finish('done'); }
        });
      }).catch(() => finish('error'));
    });
  }
  window.EarnlyWebAds = Object.freeze({enabled, testMode:TEST_MODE, supportsDailyBonus:false, showRewarded});
})();
