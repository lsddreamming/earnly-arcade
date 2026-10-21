import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from '@capacitor-community/admob';

const TEST_REWARDED_IOS = 'ca-app-pub-3940256099942544/1712485313';
const PRODUCTION_REWARDED = {
  extraPlays: 'ca-app-pub-8864401806510610/8249888009'
};

const TEST_MODE = __EARNLY_ADMOB_TEST_MODE__;
const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
let initializationPromise = null;

async function adStep(code, action) {
  try { return await action(); }
  catch (cause) {
    const error = new Error('Rewarded ad step failed: ' + code, { cause });
    error.code = code;
    throw error;
  }
}

async function ensureAdMobReady() {
  if (!isNative) return { ready:false, reason:'not-native' };

  if (!initializationPromise) {
    initializationPromise = (async () => {
      // Explicit ATT flow: do not configure a second IDFA explainer in UMP.
      // The first optional Watch Ad tap triggers this, never gameplay startup.
      let tracking = await adStep('EARNLY_AD_TRACKING', () => AdMob.trackingAuthorizationStatus());
      if (tracking.status === 'notDetermined') {
        await adStep('EARNLY_AD_TRACKING', () => AdMob.requestTrackingAuthorization());
        tracking = await adStep('EARNLY_AD_TRACKING', () => AdMob.trackingAuthorizationStatus());
      }
      if (!['authorized', 'denied', 'restricted'].includes(tracking.status)) {
        const error = new Error('Tracking permission is not resolved. Please try again.');
        error.code = 'EARNLY_AD_TRACKING';
        throw error;
      }
      // Denial/restriction is respected by iOS: no IDFA is available to the SDK.
      // SDK 8.1 requires initialization before it can present a UMP form.
      await adStep('EARNLY_AD_INITIALIZE', () => AdMob.initialize());

      let consentInfo = await adStep('EARNLY_AD_CONSENT', () => AdMob.requestConsentInfo());
      if (
        consentInfo?.isConsentFormAvailable &&
        consentInfo?.status === AdmobConsentStatus.REQUIRED
      ) {
        consentInfo = await adStep('EARNLY_AD_CONSENT', () => AdMob.showConsentForm());
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

// The iOS plugin's show promise resolves on reward, but can remain pending
// after an unrewarded dismissal. Settle from lifecycle events instead.
async function presentRewarded(options) {
  let reward = null;
  let settled = false;
  const listeners = [];
  let resolve, reject;
  const completion = new Promise((yes, no) => { resolve = yes; reject = no; });
  const finish = error => {
    if (settled) return;
    settled = true;
    for (const listener of listeners) Promise.resolve(listener.remove()).catch(() => {});
    if (error) reject(error); else resolve(reward);
  };
  try {
    listeners.push(await AdMob.addListener(RewardAdPluginEvents.Rewarded, value => {
      if (!settled) reward = value;
    }));
    listeners.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish()));
    listeners.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(new Error('Ad presentation failed'))));
    Promise.resolve(AdMob.showRewardVideoAd(options)).then(value => {
      if (!settled) reward = value;
    }, finish);
  } catch (error) { finish(error); }
  return completion;
}

async function showRewarded(kind = 'extraPlays') {
  const readiness = await ensureAdMobReady();
  if (!readiness.ready) return { earned:false, reason:readiness.reason };

  const productionId = PRODUCTION_REWARDED[kind];
  if (!productionId) throw new Error('Unknown Earnly rewarded-ad placement: ' + kind);

  const adId = TEST_MODE ? TEST_REWARDED_IOS : productionId;
  const loaded = await adStep('EARNLY_AD_LOAD', () => AdMob.prepareRewardVideoAd({
    adId,
    isTesting: TEST_MODE,
    // Non-personalized ads still require the ATT/consent flow above.
    npa: true
  }));

  const reward = await adStep('EARNLY_AD_SHOW', () => presentRewarded(
    loaded?.adUnitId ? { adId:loaded.adUnitId } : undefined
  ));

  if (!reward) return { earned:false, reason:'dismissed' };
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
