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
      // Explicit ATT flow: do not configure a second IDFA explainer in UMP.
      // The first optional Watch Ad tap triggers this, never gameplay startup.
      let tracking = await AdMob.trackingAuthorizationStatus();
      if (tracking.status === 'notDetermined') {
        await AdMob.requestTrackingAuthorization();
        tracking = await AdMob.trackingAuthorizationStatus();
      }
      if (!['authorized', 'denied', 'restricted'].includes(tracking.status)) {
        throw new Error('Tracking permission is not resolved. Please try again.');
      }
      // Denial/restriction is respected by iOS: no IDFA is available to the SDK.
      // SDK 8.1 requires initialization before it can present a UMP form.
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
  if (!consentInfo?.canRequestAds) initializationPromise = null;
  return {
    ready: !!consentInfo?.canRequestAds,
    reason: consentInfo?.canRequestAds ? '' : 'consent-not-ready',
    privacyOptionsRequired: consentInfo?.privacyOptionsRequirementStatus === 'REQUIRED'
  };
}

async function showPrivacyOptions() {
  if (!isNative) return { shown:false, reason:'not-native' };
  const readiness = await ensureAdMobReady();
  if (!readiness.privacyOptionsRequired) return { shown:false, reason:'not-required' };
  try {
    await AdMob.showPrivacyOptionsForm();
    return { shown:true };
  } finally {
    // A changed or interrupted choice must never reuse cached ad permission.
    initializationPromise = null;
  }
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
    // Non-personalized ads still require the ATT/consent flow above.
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
  showPrivacyOptions,
  showRewarded
});

window.dispatchEvent(new CustomEvent('earnly-native-ads-ready', {
  detail:{ isNative, testMode:TEST_MODE }
}));
