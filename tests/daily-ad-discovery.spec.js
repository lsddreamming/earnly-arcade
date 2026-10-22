const {test,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../daily-ad-bonus.js'),'utf8');
const styles=fs.readFileSync(path.join(__dirname,'../earn-coins.css'),'utf8');
const offer=()=>({enabled:true,goal:5,watched:0,earnedCoins:0,perAdCoins:100,completionBonus:100,coins:600,awarded:false,resetAt:'2099-01-02T00:00:00Z'});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function drain(){for(let n=0;n<20;n++)await Promise.resolve();}
function harness({native=true,enabled=true}={}){
 const elements=new Map(),events=new Map(),documentEvents=new Map(),timers=new Map(),wallets=[];
 const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},setAttribute(){}});
 const root=element(),availability=element();root.querySelector=selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);};
 let next=offer(),timerId=0,adCalls=0;next.enabled=enabled;
 const cloud={adBonus:async()=>({...next}),walletInfo:async()=>({balance:123+next.earnedCoins})};
 const ads={isNative:native,supportsDailyBonus:true,showRewarded:async()=>{adCalls++;return {earned:false,reason:'dismissed'};}};
 const window={EarnlyCloud:cloud,EarnlyNativeAds:ads,Arcade:{applyServerWallet:w=>wallets.push(w)},addEventListener:(name,fn)=>events.set(name,fn)};
 const document={hidden:false,getElementById:()=>root,querySelector:()=>availability,addEventListener:(name,fn)=>documentEvents.set(name,fn)};
 vm.runInNewContext(source,{window,document,Date,Promise,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
 return {root,availability,cloud,ads,document,wallets,timers,q:s=>root.querySelector(s),setState:s=>{next={...s};},adCalls:()=>adCalls,emit:(name)=>events.get(name)?.(),visibility:hidden=>{document.hidden=hidden;documentEvents.get('visibilitychange')?.();},tick:async()=>{const entry=timers.entries().next().value;if(entry){timers.delete(entry[0]);entry[1]();}await drain();}};
}

test('website and disabled offers never expose a working Watch ad button or grant Coins',async()=>{
 for(const options of [{native:false},{enabled:false}]){
  const h=harness(options);await drain();assert(h.root.hidden);assert(h.q('[data-watch]').hidden);await h.q('[data-watch]').onclick();await drain();assert.equal(h.adCalls(),0);assert.equal(h.wallets.length,0);
 }
 const h=harness({native:false});await drain();assert.match(h.availability.textContent,/not available on this website/);
});
test('sign-in refreshes the offer and duplicate taps cannot launch duplicate ads',async()=>{
 const h=harness({enabled:false});await drain();h.setState(offer());h.emit('earnly-cloud-auth-change');await drain();assert.equal(h.root.hidden,false);assert.equal(h.q('[data-watch]').disabled,false);
 const ad=deferred();let calls=0;h.ads.showRewarded=()=>{calls++;return ad.promise;};h.q('[data-watch]').onclick();h.q('[data-watch]').onclick();assert.equal(calls,1);ad.resolve({earned:false,reason:'dismissed'});await drain();assert.equal(h.wallets.length,0);assert.equal(h.q('[data-watch]').disabled,false);assert.match(h.q('[data-status]').textContent,/No reward was added/);
});
test('SDK completion alone never credits Coins; one verified receipt refreshes the server wallet once',async()=>{
 const h=harness();await drain();h.ads.showRewarded=async()=>({earned:true});await h.q('[data-watch]').onclick();await drain();assert.equal(h.wallets.length,0);assert(h.q('[data-watch]').disabled);assert.equal(h.timers.size,1);
 h.setState({...offer(),watched:1,earnedCoins:100});await h.tick();assert.equal(h.wallets.length,1);assert.equal(h.wallets[0].balance,223);assert.equal(h.q('[data-watch]').disabled,false);assert.match(h.q('[data-progress]').textContent,/1 \/ 5 verified/);
 h.emit('focus');await drain();assert.equal(h.wallets.length,1);
});
test('pending verification resumes after pagehide and visibility changes without replaying the ad',async()=>{
 for(const mode of ['page','visibility']){
  const h=harness();await drain();let calls=0;h.ads.showRewarded=async()=>{calls++;return {earned:true};};await h.q('[data-watch]').onclick();await drain();assert.equal(h.timers.size,1);
  if(mode==='page')h.emit('pagehide');else h.visibility(true);assert.equal(h.timers.size,0);
  h.setState({...offer(),watched:1,earnedCoins:100});if(mode==='page')h.emit('pageshow');else h.visibility(false);await drain();assert.equal(calls,1);assert.equal(h.wallets.length,1);assert.equal(h.q('[data-watch]').disabled,false);
 }
});
test('account changes discard stale ad, status and wallet responses',async()=>{
 const h=harness();await drain();const ad=deferred();h.ads.showRewarded=()=>ad.promise;h.q('[data-watch]').onclick();h.setState({...offer(),enabled:false});h.emit('earnly-cloud-auth-change');await drain();ad.resolve({earned:true});await drain();assert.equal(h.wallets.length,0);assert(h.root.hidden);assert.equal(h.timers.size,0);
 const other=harness();await drain();const wallet=deferred();other.cloud.walletInfo=()=>wallet.promise;other.setState({...offer(),watched:1,earnedCoins:100});other.emit('focus');await drain();other.setState({...offer(),enabled:false});other.emit('earnly-cloud-auth-change');await drain();wallet.resolve({balance:9999});await drain();assert.equal(other.wallets.length,0);assert(other.root.hidden);
 const stale=harness();await drain();const response=deferred();stale.cloud.adBonus=()=>response.promise;stale.emit('focus');await drain();stale.cloud.adBonus=async()=>({...offer(),enabled:false});stale.emit('earnly-cloud-auth-change');await drain();response.resolve({...offer(),watched:1,earnedCoins:100});await drain();assert(stale.root.hidden);assert.equal(stale.wallets.length,0);
});
test('failed refresh has a safe retry; verification timeout never invents a reward',async()=>{
 const h=harness();await drain();h.cloud.adBonus=async()=>{throw Error('offline');};h.emit('focus');await drain();assert(h.q('[data-watch]').disabled);assert.equal(h.q('[data-retry]').hidden,false);await h.q('[data-watch]').onclick();assert.equal(h.adCalls(),0);
 h.cloud.adBonus=async()=>offer();h.q('[data-retry]').onclick();await drain();assert.equal(h.q('[data-watch]').disabled,false);assert(h.q('[data-retry]').hidden);
 h.ads.showRewarded=async()=>({earned:true});await h.q('[data-watch]').onclick();await drain();for(let n=0;n<11;n++)await h.tick();assert.equal(h.wallets.length,0);assert.match(h.q('[data-status]').textContent,/still being verified/);assert.equal(h.timers.size,0);
});
test('a verified receipt across the daily reset refreshes the wallet and does not stay pending',async()=>{
 const h=harness();await drain();h.setState({...offer(),watched:4,earnedCoins:400});h.emit('focus');await drain();h.wallets.length=0;h.ads.showRewarded=async()=>({earned:true});await h.q('[data-watch]').onclick();await drain();
 h.setState({...offer(),resetAt:'2099-01-03T00:00:00Z',watched:1,earnedCoins:100});await h.tick();assert.equal(h.wallets.length,1);assert.equal(h.q('[data-watch]').disabled,false);assert.match(h.q('[data-progress]').textContent,/1 \/ 5 verified/);
});

test('a verified reward retries a failed wallet refresh without replaying the ad',async()=>{
 const h=harness();await drain();let reads=0;h.cloud.walletInfo=async()=>{reads++;if(reads===1)throw Error('offline');return {balance:223};};
 h.setState({...offer(),watched:1,earnedCoins:100});h.emit('focus');await drain();assert.equal(h.wallets.length,0);assert.match(h.q('[data-status]').textContent,/wallet will refresh/);
 h.emit('focus');await drain();assert.equal(h.wallets.length,1);assert.equal(h.wallets[0].balance,223);h.emit('focus');await drain();assert.equal(reads,2);assert.equal(h.wallets.length,1);assert.equal(h.adCalls(),0);
});

async function mount(page,native){
 await page.setContent('<main class="rewards-dashboard"><section class="earn-coins-hub"><h2>Get more Arcade Coins</h2><div class="earn-coins-options"><a href="index.html#dailyBonusButton"><strong>Daily bonus</strong><span>Claim free Coins</span></a><a href="games.html"><strong>Play &amp; earn</strong><span>Pick a game</span></a></div><section id="daily-furniture-boost" hidden></section><p class="earn-ads-availability" role="status"></p></section></main>');
 await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0;background:#081222;color:white;font:16px system-ui}main{padding:12px}'+styles});
 await page.evaluate(({native,state})=>{window.testRewardState=state;window.rewardCalls=0;window.walletUpdates=[];window.EarnlyCloud={adBonus:async()=>({...window.testRewardState}),walletInfo:async()=>({balance:123+window.testRewardState.earnedCoins})};window.Arcade={applyServerWallet:w=>window.walletUpdates.push(w)};window.EarnlyNativeAds={isNative:native,supportsDailyBonus:true,showRewarded:async()=>{window.rewardCalls++;return {earned:true};}};},{native,state:offer()});
 await page.addScriptTag({content:source});
}
test('website rewards show useful alternatives, not a misleading Watch ad offer',async({page})=>{
 await mount(page,false);await expect(page.locator('#daily-furniture-boost')).toBeHidden();await expect(page.locator('.earn-ads-availability')).toContainText('not available on this website');await expect(page.getByRole('link',{name:/Daily bonus/})).toBeVisible();await expect(page.getByRole('link',{name:/Play & earn/})).toBeVisible();expect(await page.evaluate(()=>window.rewardCalls)).toBe(0);
});
test('the verified reward offer is readable, keyboard accessible and fits small phones',async({page})=>{
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await mount(page,true);const watch=page.locator('[data-watch]');await expect(watch).toBeEnabled();await expect(watch).toHaveText('Watch ad · +100 Coins');await watch.focus();await expect(watch).toBeFocused();const b=await watch.boundingBox();expect(b.height).toBeGreaterThanOrEqual(44);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
});
test('background return reconciles real server progress in the browser, never the SDK alone',async({page})=>{
 await mount(page,true);await page.locator('[data-watch]').click();await expect(page.locator('[data-watch]')).toBeDisabled();expect(await page.evaluate(()=>window.walletUpdates.length)).toBe(0);
 await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));window.testRewardState={...window.testRewardState,watched:1,earnedCoins:100};window.dispatchEvent(new Event('pageshow'));});
 await expect(page.locator('[data-progress]')).toContainText('1 / 5 verified');await expect(page.locator('[data-watch]')).toBeEnabled();expect(await page.evaluate(()=>window.rewardCalls)).toBe(1);expect(await page.evaluate(()=>window.walletUpdates.length)).toBe(1);
});
