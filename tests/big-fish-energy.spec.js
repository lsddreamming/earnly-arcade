const {test,expect}=require('@playwright/test');

// Capture the public engine constructor only inside this test page. Production
// exposes no debug controls, and these scenarios never call a reward endpoint.
async function open(page){
  await page.route('**/functions/v1/big-fish-energy',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'REWARDS_UNAVAILABLE'})}));
  await page.addInitScript(()=>{
    let engine;
    Object.defineProperty(window,'BigFishEnergy',{configurable:true,get:()=>engine,set(value){
      engine={...value,create(options){const result=value.create(options);window.__fishTestGame=result;return result;}};
    }});
  });
  await page.goto('/big-fish-energy.html');
}
async function start(page){await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();}
async function frozen(page){await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));}

test('first dive, active controls and menus fit narrow iPhones without horizontal scrolling',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [width,height] of [[320,568],[390,844],[440,956]]){
    await page.setViewportSize({width,height});await open(page);
    await expect(page.locator('#start')).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await start(page);
    for(const id of ['#pause','#boost']){const b=await page.locator(id).boundingBox();expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.y+b.height).toBeLessThanOrEqual(height);}
    await page.locator('#pause').click();await expect(page.locator('#resume')).toBeInViewport();
  }
  await page.screenshot({path:info.outputPath('big-fish-energy-mobile-pause.png')});expect(errors).toEqual([]);
});

test('pause and backgrounding freeze simulation; fresh touch works after resume',async({page})=>{
  await frozen(page);await open(page);await start(page);await page.clock.runFor(500);
  await page.locator('#pause').click();const before=await page.evaluate(()=>window.__fishTestGame.snapshot());
  await page.clock.runFor(5000);expect(await page.evaluate(()=>window.__fishTestGame.snapshot())).toEqual(before);
  await page.locator('#resume').click();await page.clock.runFor(500);
  expect(await page.evaluate(()=>window.__fishTestGame.state.time)).toBeGreaterThan(before.time);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.locator('#pauseSheet')).toBeVisible();
  await page.locator('#resume').click();const box=await page.locator('#sea').boundingBox();
  const origin=await page.evaluate(()=>({x:window.__fishTestGame.state.player.x,y:window.__fishTestGame.state.player.y}));
  await page.mouse.move(box.x+box.width*.8,box.y+box.height*.55);await page.mouse.down();await page.clock.runFor(600);await page.mouse.up();
  const after=await page.evaluate(()=>({x:window.__fishTestGame.state.player.x,y:window.__fishTestGame.state.player.y}));
  expect(Math.hypot(after.x-origin.x,after.y-origin.y)).toBeGreaterThan(.1);
  expect(await page.locator('#sea').evaluate(el=>getComputedStyle(el).touchAction)).toBe('none');
});

test('a real edible collision grows the HUD, larger predator ends once, replay works, best persists',async({page},info)=>{
  await frozen(page);await open(page);await start(page);
  await page.evaluate(()=>{const s=window.__fishTestGame.state,p=s.player;const f=s.fish[0];Object.assign(f,{x:p.x,y:p.y,size:.29});s.fish=[f];});
  await page.clock.runFor(200);await expect(page.locator('#eaten')).toContainText('1 fish');
  expect(await page.evaluate(()=>window.__fishTestGame.state.player.size)).toBeGreaterThan(.3);
  await page.evaluate(()=>{const s=window.__fishTestGame.state,p=s.player;s.time=5;const f=s.fish[0];Object.assign(f,{x:p.x,y:p.y,size:p.size*2});s.fish=[f];});
  await page.clock.runFor(200);await expect(page.locator('#resultSheet')).toBeVisible();
  await expect(page.locator('#pauseSheet')).toBeHidden();await expect(page.locator('#rewardStatus')).toContainText('no Arcade Coins');
  await expect(page.locator('#resultBest')).toContainText('New personal best');
  await page.screenshot({path:info.outputPath('big-fish-energy-results.png')});
  await page.locator('#replay').click();await expect(page.locator('#resultSheet')).toBeHidden();
  await expect(page.locator('#size')).toHaveText('30 cm');await page.reload();await expect(page.locator('#best')).not.toHaveText('Be the first');
});

test('timed mode finishes at its limit and leaderboard unavailable state is honest',async({page})=>{
  await frozen(page);await open(page);await page.locator('#leaderboardButton').click();
  await expect(page.locator('#leaderboardStatus')).toContainText('verified release');
  await page.locator('#closeLeaderboard').click();await page.locator('#mode').selectOption('timed');await start(page);
  await page.evaluate(()=>{const s=window.__fishTestGame.state;s.time=179.9;s.fish=[];});
  await page.clock.runFor(300);await expect(page.locator('#resultSheet')).toBeVisible();await expect(page.locator('#resultTitle')).toContainText('Bigger energy');
  await page.locator('#menu').click();await expect(page.locator('#intro')).toBeVisible();
});

test('landscape and enormous fish retain visible controls and a finite camera',async({page},info)=>{
  await page.setViewportSize({width:844,height:390});await frozen(page);await open(page);await start(page);
  await page.evaluate(()=>{const s=window.__fishTestGame.state;s.player.size=10000;s.fish=[];});
  await page.clock.runFor(1600);await expect(page.locator('#zone')).toHaveText('Endless Abyss');
  await expect(page.locator('#size')).toHaveText('10.0 km');await expect(page.locator('#pause')).toBeInViewport();await expect(page.locator('#boost')).toBeInViewport();
  expect(await page.evaluate(()=>Array.from(document.querySelector('#sea').getContext('2d').getTransform().toFloat64Array()).every(Number.isFinite))).toBe(true);
  await page.screenshot({path:info.outputPath('big-fish-energy-abyss-landscape.png')});
});

test('big bite feedback explains growth and voluntary finish saves without a fake death',async({page},info)=>{
  await frozen(page);await open(page);await start(page);
  await page.evaluate(()=>{const s=window.__fishTestGame.state,p=s.player;const f=s.fish[0];Object.assign(f,{x:p.x,y:p.y,size:.29});s.fish=[f];});
  await page.clock.runFor(200);
  await expect(page.locator('#biteFeedback')).toContainText('BIG BITE!');
  await expect(page.locator('#biteFeedback')).toHaveText(/BIG BITE! \+[0-9.]+%/);
  expect(await page.locator('#biteFeedback').evaluate(el=>Number(getComputedStyle(el).opacity))).toBeGreaterThan(0);
  const actualSize=await page.evaluate(()=>window.__fishTestGame.state.player.size);
  await page.locator('#pause').click();await page.locator('#endDive').click();
  await expect(page.locator('#pauseSheet')).toBeHidden();await expect(page.locator('#resultSheet')).toBeVisible();
  await expect(page.locator('#resultReason')).toHaveText('Dive complete. Your best size is saved.');
  await expect(page.locator('#resultBest')).toContainText('New personal best');
  expect(await page.evaluate(()=>window.__fishTestGame.state.dead)).toBe(false);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('earnly-big-fish-energy-best-v1')).size)).toBe(actualSize);
  const stopped=await page.evaluate(()=>window.__fishTestGame.snapshot());await page.clock.runFor(2000);
  expect(await page.evaluate(()=>window.__fishTestGame.snapshot())).toEqual(stopped);
  await page.screenshot({path:info.outputPath('big-fish-energy-saved-dive.png')});
  await page.locator('#replay').click();await expect(page.locator('#resultSheet')).toBeHidden();await expect(page.locator('#size')).toHaveText('30 cm');
});

test('start screen provides standard static information links without covering gameplay',async({page,request})=>{
  for(const prefix of ['','www/']){
    const response=await request.get('/'+prefix+'big-fish-energy.html');expect(response.ok()).toBe(true);
    const html=await response.text();expect(html).toContain('href="public-info.css"');
    const footer=html.match(/<footer class="public-footer"[\s\S]*?<\/footer>/)?.[0];expect(footer).toContain('aria-label="Site information"');
    for(const target of ['index.html','games.html','about.html','game-guides.html','support.html','privacy.html','terms.html'])expect(footer).toContain('href="'+target+'"');
  }
  await open(page);await page.locator('.site-links summary').click();await expect(page.locator('.public-footer')).toBeVisible();
  await expect(page.locator('.public-footer a[href="support.html"]')).toBeVisible();await start(page);await expect(page.locator('.public-footer')).toBeHidden();
});
