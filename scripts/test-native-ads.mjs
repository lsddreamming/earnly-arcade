import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync('native-ads-entry.js','utf8').replace(/^import .*;\n/gm,'');
function harness(initial='notDetermined', answer='authorized', canRequestAds=true, fail=false, options={}) {
  const calls=[]; let status=initial;
  const AdMob={
    trackingAuthorizationStatus:async()=>{calls.push('status');return {status};},
    requestTrackingAuthorization:async()=>{calls.push('att');if(fail) throw Error('unavailable');status=answer;},
    initialize:async()=>calls.push('initialize'),
    requestConsentInfo:async()=>{calls.push('consent');if(options.failConsent) throw Error('Request consent info failed');return {canRequestAds:options.canRequestAds ?? canRequestAds,status:'NOT_REQUIRED',privacyOptionsRequirementStatus:options.privacyOptionsRequired ? 'REQUIRED' : 'NOT_REQUIRED'};},
    prepareRewardVideoAd:async request=>{calls.push('load');if(options.failLoad) throw Error('No fill');assert.equal(request.npa,true);assert.equal(request.isTesting,options.testMode !== false);assert.equal(request.adId, options.testMode === false ? 'ca-app-pub-8864401806510610/8249888009' : 'ca-app-pub-3940256099942544/1712485313');return {};},
    showPrivacyOptionsForm:async()=>{calls.push('privacy');if(options.failPrivacy) throw Error('interrupted');options.canRequestAds=false;},
    showRewardVideoAd:async()=>{calls.push('show');if(options.failShow) throw Error('Closed');return {amount:1};}
  };
  const window={dispatchEvent(){}};
  vm.runInNewContext(source,{AdMob,Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'ios'},AdmobConsentStatus:{REQUIRED:'REQUIRED'},__EARNLY_ADMOB_TEST_MODE__:options.testMode !== false,window,CustomEvent:class {}});
  return {calls,ads:window.EarnlyNativeAds};
}
test('first ad waits for ATT before SDK, consent and loading',async()=>{
  const h=harness();assert.equal(h.calls.length,0);
  assert.equal((await h.ads.showRewarded()).earned,true);
  assert.deepEqual(h.calls,['status','att','status','initialize','consent','load','show']);
});
for(const status of ['authorized','denied','restricted']) test(`${status} skips repeat prompt and preserves non-personalized ads`,async()=>{
  const h=harness(status);await h.ads.showRewarded();assert.ok(!h.calls.includes('att'));assert.ok(h.calls.includes('load'));
});
test('unresolved ATT never initializes or loads and can retry',async()=>{
  const h=harness('notDetermined','notDetermined');await assert.rejects(h.ads.ensureReady());await assert.rejects(h.ads.ensureReady());
  assert.ok(!h.calls.includes('initialize'));assert.equal(h.calls.filter(x=>x==='att').length,2);
});
test('ATT errors fail closed',async()=>{
  const h=harness('notDetermined','authorized',true,true);await assert.rejects(h.ads.showRewarded());assert.ok(!h.calls.includes('initialize'));
});
test('consent blocks ad requests and rewards',async()=>{
  const h=harness('denied','denied',false);assert.equal((await h.ads.showRewarded()).earned,false);assert.ok(!h.calls.includes('load'));assert.ok(!h.calls.includes('show'));
});
test('concurrent readiness only initializes once',async()=>{
  const h=harness();await Promise.all([h.ads.ensureReady(),h.ads.ensureReady()]);assert.equal(h.calls.filter(x=>x==='att').length,1);assert.equal(h.calls.filter(x=>x==='initialize').length,1);
});

test('production loads the configured live rewarded unit, never the sample unit', async()=>{
  const h=harness('denied','denied',true,false,{testMode:false});
  assert.equal((await h.ads.showRewarded()).earned,true);
});
test('privacy choices do not load ads or grant rewards and invalidate cached permission', async()=>{
  const options={privacyOptionsRequired:true};
  const h=harness('denied','denied',true,false,options);
  assert.equal((await h.ads.showPrivacyOptions()).shown,true);
  assert.ok(!h.calls.includes('load')); assert.ok(!h.calls.includes('show'));
  assert.equal((await h.ads.showRewarded()).earned,false);
  assert.equal(h.calls.filter(x=>x==='consent').length,2);
});
test('unavailable privacy options do not attempt a form or an ad', async()=>{
  const h=harness('denied');assert.equal((await h.ads.showPrivacyOptions()).shown,false);
  assert.ok(!h.calls.includes('privacy'));assert.ok(!h.calls.includes('load'));
});
test('interrupted privacy form invalidates cached permission', async()=>{
  const options={privacyOptionsRequired:true,failPrivacy:true};
  const h=harness('denied','denied',true,false,options);
  await assert.rejects(h.ads.showPrivacyOptions());options.canRequestAds=false;
  assert.equal((await h.ads.showRewarded()).earned,false);
  assert.equal(h.calls.filter(x=>x==='consent').length,2);
});

test('consent not ready can recover on a later attempt',async()=>{
  const options={canRequestAds:false};const h=harness('denied','denied',false,false,options);
  assert.equal((await h.ads.showRewarded()).earned,false);options.canRequestAds=true;
  assert.equal((await h.ads.showRewarded()).earned,true);
});

test('consent setup failures are distinct from no-fill and can retry without a reward',async()=>{
  const options={failConsent:true};const h=harness('denied','denied',true,false,options);
  await assert.rejects(h.ads.showRewarded(),error=>error.code==='EARNLY_AD_CONSENT');
  assert.ok(!h.calls.includes('load'));assert.ok(!h.calls.includes('show'));
  options.failConsent=false;assert.equal((await h.ads.showRewarded()).earned,true);
});
for(const [option,code] of [['failLoad','EARNLY_AD_LOAD'],['failShow','EARNLY_AD_SHOW']]) test(`${code} never returns an earned reward`,async()=>{
  const h=harness('denied','denied',true,false,{[option]:true});
  await assert.rejects(h.ads.showRewarded(),error=>error.code===code);
  if(option==='failLoad') assert.ok(!h.calls.includes('show'));
});
