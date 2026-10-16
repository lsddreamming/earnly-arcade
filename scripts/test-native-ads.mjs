import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync('native-ads-entry.js','utf8').replace(/^import .*;\n/gm,'');
function harness(initial='notDetermined', answer='authorized', canRequestAds=true, fail=false) {
  const calls=[]; let status=initial;
  const AdMob={
    trackingAuthorizationStatus:async()=>{calls.push('status');return {status};},
    requestTrackingAuthorization:async()=>{calls.push('att');if(fail) throw Error('unavailable');status=answer;},
    initialize:async()=>calls.push('initialize'),
    requestConsentInfo:async()=>{calls.push('consent');return {canRequestAds,status:'NOT_REQUIRED'};},
    prepareRewardVideoAd:async options=>{calls.push('load');assert.equal(options.npa,true);return {};},
    showRewardVideoAd:async()=>{calls.push('show');return {amount:1};}
  };
  const window={dispatchEvent(){}};
  vm.runInNewContext(source,{AdMob,Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'ios'},AdmobConsentStatus:{REQUIRED:'REQUIRED'},__EARNLY_ADMOB_TEST_MODE__:true,window,CustomEvent:class {}});
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
