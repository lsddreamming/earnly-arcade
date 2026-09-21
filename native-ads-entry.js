import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';

const TEST_REWARDED_IOS = 'ca-app-pub-3940256099942544/1712485313';
const PRODUCTION_REWARDED = {
  extraPlays: 'ca-app-pub-8864401806510610/8249888009'
};

const TEST_MODE = __EARNLY_ADMOB_TEST_MODE__;
const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
let initializationPromise = null;

async function ensureAdMobReady() {
  if (!isNative) return { ready:false, reason:'not-native' };

  if (!initializationPromise) {
    initializationPromise = (async () => {
      await AdMob.initialize();

      let consentInfo = await AdMob.requestConsentInfo();
      if (
        consentInfo?.isConsentFormAvailable &&
        consentInfo?.status === AdmobConsentStatus.REQUIRED
      ) {
        consentInfo = await AdMob.showConsentForm();
      }

      return consentInfo;
    })().catch(error => {
      initializationPromise = null;
      throw error;
    });
  }

  const consentInfo = await initializationPromise;
  return {
    ready: !!consentInfo?.canRequestAds,
    reason: consentInfo?.canRequestAds ? '' : 'consent-not-ready'
  };
}

async function showRewarded(kind = 'extraPlays') {
  const readiness = await ensureAdMobReady();
  if (!readiness.ready) return { earned:false, reason:readiness.reason };

  const productionId = PRODUCTION_REWARDED[kind];
  if (!productionId) throw new Error('Unknown Earnly rewarded-ad placement: ' + kind);

  const adId = TEST_MODE ? TEST_REWARDED_IOS : productionId;
  const loaded = await AdMob.prepareRewardVideoAd({
    adId,
    isTesting: TEST_MODE,
    // Version 1.0 requests non-personalized rewarded ads. This keeps the
    // launch build simpler for App Store privacy/ATT while still allowing
    // rewarded ads to function.
    npa: true
  });

  const reward = await AdMob.showRewardVideoAd(
    loaded?.adUnitId ? { adId:loaded.adUnitId } : undefined
  );

  return {
    earned:true,
    amount:Number(reward?.amount || 1),
    type:String(reward?.type || ''),
    placement:kind,
    testMode:TEST_MODE
  };
}

window.EarnlyNativeAds = Object.freeze({
  isNative,
  testMode:TEST_MODE,
  ensureReady:ensureAdMobReady,
  showRewarded
});

window.dispatchEvent(new CustomEvent('earnly-native-ads-ready', {
  detail:{ isNative, testMode:TEST_MODE }
}));
