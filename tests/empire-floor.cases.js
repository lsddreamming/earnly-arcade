const {test,expect}=require('@playwright/test');

test('Arcade Empire renders its interactive floor and preserves sales after reload',async({page})=>{
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  // WebKit can return a context whose GPU process has already been lost.
  const supportsWebGL = await page.evaluate(() => {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const gl = probe.getContext('webgl2', {antialias:true, powerPreference:'low-power'});
    if (!gl || gl.isContextLost()) return false;
    const pixel = new Uint8Array(4);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const rendered = pixel[0] === 255 && !gl.isContextLost();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return rendered;
  });
  await page.goto('/spuds-arcade-empire.html');
  const floor=page.locator('figure canvas');
  await expect(floor).toBeVisible();
  if(supportsWebGL){
    await expect.poll(()=>floor.evaluate(el=>el.getAttribute('data-renderer'))).toBe('three');
  } else {
    // Accept a recovered GPU, otherwise require visible pixels on the fallback.
    await expect.poll(() => floor.evaluate(el => {
      if (el.dataset.renderer === 'three') return true;
      if (!document.querySelector('script[src="empire-floor.js"]')) return false;
      const ctx = el.getContext('2d');
      return !!ctx && ctx.getImageData(el.width >> 1, el.height >> 1, 1, 1).data[3] > 0;
    })).toBe(true);
  }
  const serve=page.getByRole('button',{name:'Serve a customer'});
  await serve.click();
  await expect(page.locator('#cash')).toHaveText('$5');
  await page.locator('#zoom').click();
  await expect(page.locator('#zoom')).toHaveText('1.2×');
  await page.reload();
  await expect(page.locator('#cash')).toHaveText('$5');
  expect(errors).toEqual([]);
});

test('a returning counter worker opens and keeps the app workshop',async({page})=>{
  // Seed the returning save before the game starts its pagehide checkpoint.
  await page.route('**/empire-save-fixture', route => route.fulfill({contentType:'text/html',body:'<!doctype html>'}));
  await page.goto('/empire-save-fixture');
  await page.evaluate(()=>localStorage.setItem('earnly.empire.guest.v1',JSON.stringify({
    levels:[1,0,0,0,0],venue:0,served:15,cash:450,lifetime:450
  })));
  await page.goto('/spuds-arcade-empire.html');
  await page.getByRole('button',{name:'Studio',exact:true}).click();
  await page.getByRole('button',{name:'$450',exact:true}).click();
  await expect(page.locator('#cash')).toHaveText('$0');
  await expect(page.getByText('App Workshop · Developer')).toBeVisible();
  await page.getByRole('button',{name:'Work shift'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Studio',exact:true}).click();
  await expect(page.getByText('App Workshop · Developer')).toBeVisible();
});


// These are mocked native bridge tests, not AdMob SDK/device verification.
const empireKey='earnly.empire.guest.v1';
async function empireFixture(page,{native=true,away=false,ad='success'}={}){
  await page.route('**/empire-save-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html>'}));
  await page.goto('/empire-save-fixture');
  await page.evaluate(({key,away})=>localStorage.setItem(key,JSON.stringify({
    venue:0,levels:[1,away?1:0,0,0,0],cash:0,lifetime:0,served:0,stamp:away?Date.now()-120000:0
  })),{key:empireKey,away});
  if(native)await page.addInitScript(({ad})=>{
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios'};
    window.adCalls=[];
    window.adMode=ad;
    window.EarnlyNativeAds={isNative:true,showRewarded:kind=>{
      window.adCalls.push(kind);
      if(window.adMode==='reject')return Promise.reject(new Error('mock no fill'));
      if(window.adMode==='dismiss')return Promise.resolve({earned:false});
      if(window.adMode==='defer')return new Promise(resolve=>{window.finishAd=resolve});
      return Promise.resolve({earned:true,testMode:true});
    }};
  },{ad});
  await page.goto('/spuds-arcade-empire.html');
}

test('Empire web play never loads or requires native ads; base offline profits stay free',async({page})=>{
  const requests=[];
  page.on('request',r=>{if(r.url().endsWith('/native-ads.js'))requests.push(r.url())});
  await empireFixture(page,{native:false,away:true});
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('#cash')).not.toHaveText('$0');
  await expect(page.locator('#offline-double')).toBeHidden();
  await expect(page.locator('#boost')).toBeHidden();
  await expect(page.locator('#investor')).toBeHidden();
  await page.locator('#collect').click();
  await expect(page.locator('dialog')).toBeHidden();
  expect(await page.evaluate(()=>state.offlineOffer)).toBeNull();
  await page.locator('#serve').click();
  expect(await page.evaluate(()=>state.served)).toBe(1);
  expect(requests).toEqual([]);
});

test('Empire mocked offline reward is exactly one matching bonus and survives reload',async({page})=>{
  await empireFixture(page,{away:true,ad:'defer'});
  await expect(page.locator('#offline-double')).toBeVisible();
  const start=await page.evaluate(()=>{
    // Freeze attendant income after the initial settlement so the ad delta is exact.
    state.levels[1]=0;save();
    const offer={...state.offlineOffer};
    const cash=state.cash,lifetime=state.lifetime;
    document.querySelector('#offline-double').click();
    // Programmatic duplicate taps also must not start another request.
    document.querySelector('#offline-double').onclick();
    document.querySelector('#boost').onclick();
    return {offer,cash,lifetime,calls:window.adCalls};
  });
  expect(start.offer.amount).toBeGreaterThan(0);
  expect(start.calls).toEqual(['extraPlays']);
  await expect(page.locator('dialog')).toBeHidden();
  await expect(page.locator('#serve')).toBeEnabled();
  await page.evaluate(()=>window.finishAd({earned:true,testMode:true}));
  await expect(page.locator('#notice')).toContainText('Offline earnings doubled');
  expect(await page.evaluate(offer=>({
    cash:state.cash,lifetime:state.lifetime,pending:state.offlineOffer,
    duplicate:claimOfflineBonus(offer)
  }),start.offer)).toEqual({
    cash:start.cash+start.offer.amount,lifetime:start.lifetime+start.offer.amount,pending:null,duplicate:false
  });
  await page.reload();
  await expect(page.locator('#offline-reopen')).toBeHidden();
  await expect(page.locator('dialog')).toBeHidden();
  expect(await page.evaluate(()=>state.cash)).toBe(start.cash+start.offer.amount);
});

test('Empire mocked dismissal and no fill preserve the base payout and allow retry or decline',async({page})=>{
  await empireFixture(page,{away:true,ad:'dismiss'});
  await expect(page.locator('#offline-double')).toBeVisible();
  const before=await page.evaluate(()=>{state.levels[1]=0;save();return {cash:state.cash,offer:state.offlineOffer}});
  await page.locator('#offline-double').click();
  await expect(page.locator('#notice')).toContainText('No ad reward earned');
  await expect(page.locator('#offline-reopen')).toBeVisible();
  await page.evaluate(()=>window.adMode='reject');
  await page.locator('#offline-reopen').click();
  await page.locator('#offline-double').click();
  await expect(page.locator('#notice')).toContainText('Ad unavailable');
  expect(await page.evaluate(()=>({cash:state.cash,offer:state.offlineOffer}))).toEqual(before);
  await page.locator('#offline-reopen').click();
  await page.locator('#collect').click();
  await expect(page.locator('#offline-reopen')).toBeHidden();
  await page.reload();
  expect(await page.evaluate(()=>({cash:state.cash,offer:state.offlineOffer}))).toEqual({cash:before.cash,offer:null});
});

test('Empire mocked profit boost doubles operating revenue, not customer pacing, and expires',async({page})=>{
  await page.clock.install();
  await empireFixture(page,{ad:'defer'});
  await expect(page.locator('#boost')).toBeVisible();
  expect(await page.evaluate(()=>profitMultiplier())).toBe(1);
  await page.locator('#boost').click();
  await page.evaluate(()=>document.querySelector('#boost').onclick());
  expect(await page.evaluate(()=>window.adCalls.length)).toBe(1);
  await page.evaluate(()=>window.finishAd({earned:true,testMode:true}));
  await expect(page.locator('#boost')).toContainText('2× profits active');
  const boosted=await page.evaluate(()=>({start:state.boostStart,until:state.boostUntil,base:ticket()}));
  expect(boosted.until-boosted.start).toBe(600000);
  await page.locator('#serve').click();
  expect(await page.evaluate(()=>({cash:state.cash,served:state.served}))).toEqual({cash:boosted.base*2,served:1});
  await expect(page.locator('#serve')).toBeDisabled();
  await page.evaluate(()=>document.querySelector('#serve').onclick());
  expect(await page.evaluate(()=>state.served)).toBe(1);
  expect(await page.evaluate(({start,until})=>{
    state.levels[1]=1;
    const result={base:rate(),inside:activeIncome(1,start+2000),boundary:activeIncome(2,until+1000),after:activeIncome(1,until+2000)};
    state.levels[1]=0;save();return result;
  },boosted)).toEqual({base:5/24,inside:2*(5/24),boundary:3*(5/24),after:5/24});
  await page.reload();
  await expect(page.locator('#boost')).toContainText('2× profits active');
  expect(await page.evaluate(()=>state.boostUntil)).toBe(boosted.until);
  await page.clock.fastForward(601000);
  await expect(page.locator('#boost')).toBeEnabled();
  await expect(page.locator('#boost')).toContainText('Watch an ad');
  expect(await page.evaluate(()=>profitMultiplier())).toBe(1);
  await page.locator('#serve').click();
  expect(await page.evaluate(()=>({cash:state.cash,served:state.served}))).toEqual({cash:boosted.base*3,served:2});
});

test('Empire preserves the original investor reward and cooldown under mocked native ads',async({page})=>{
  await empireFixture(page);
  await expect(page.locator('#investor')).toBeVisible();
  await page.locator('#investor').click();
  await expect(page.locator('#notice')).toContainText('Investor delivered');
  expect(await page.evaluate(()=>({cash:state.cash,cooldown:state.nextInvestor>Date.now(),calls:window.adCalls}))).toEqual({cash:20,cooldown:true,calls:['extraPlays']});
  await expect(page.locator('#investor')).toBeHidden();
  await page.reload();
  await expect(page.locator('#investor')).toBeHidden();
  expect(await page.evaluate(()=>state.cash)).toBe(20);
});
