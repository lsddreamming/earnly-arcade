const {test,expect}=require('@playwright/test');
test.use({viewport:{width:390,height:844},launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
test('3D phone graphics boot and rotated view',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/spuddy-evolution.html');
  await expect(page.locator('#world')).toHaveAttribute('data-renderer','webgl-3d');
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click();
  await page.screenshot({path:info.outputPath('3d-phone-front.png')});
  await page.locator('#camera').click();
  await expect(page.locator('#toast')).toContainText('View rotated');
  await page.waitForTimeout(700);
  await page.screenshot({path:info.outputPath('3d-phone-rotated.png')});
  await page.locator('#upgrades').click();
  await expect(page.locator('#evolutionGoal')).toHaveText('0/5 upgrades to Rootling');
  await expect(page.locator('#evolutionAbility')).toContainText('stronger Root burst');
  await page.screenshot({path:info.outputPath('3d-phone-evolution.png')});
  await page.locator('#journeyButton').click();
  await expect(page.locator('#chapterTitle')).toHaveText('Expedition 1 / 100');
  await expect(page.locator('#nextChapter')).toBeDisabled();
  await page.screenshot({path:info.outputPath('3d-phone-journey.png')});
  expect(errors).toEqual([]);
});
test('all five boss designs render with attack poses',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1100,height:1000});
  await page.route('**/monster-gallery.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{display:block}</style><canvas id="gallery"></canvas><script src="/spuddy-evolution-engine.js"></script><script src="/spuddy-evolution-3d.js"></script>'}));
  await page.goto('/monster-gallery.html');
  await page.evaluate(()=>{
    const g=SpuddyEvolution.create({version:1,bosses:[true,true,true,true,true],unlocked:4},()=>.4);
    const r=EvolutionRenderer.create(document.getElementById('gallery'),g);if(!r.available)throw Error('3D gallery unavailable');
    if(!g.nextChapter())throw Error('Expedition transition failed');g.s.x=0;g.s.z=-4;g.s.save.unlocked=4;
    g.s.enemies=g.s.enemies.filter(e=>e.boss);
    g.s.enemies.forEach((e,i)=>{e.x=[-8,0,8,-5,5][i];e.z=[-11,-11,-11,1,1][i];e.windup=1;e.targetX=e.x;e.targetZ=e.z+2;});
    for(let i=0;i<20;i++){g.s.time+=.05;g.s.enemies.forEach(e=>e.phase+=.05);r.draw(.05);}
    window.galleryRenderer=r; window.galleryDiagnostics=r.diagnostics();
  });
  const diagnostics=await page.evaluate(()=>window.galleryDiagnostics);
  expect(diagnostics.actorCount).toBe(65);expect(diagnostics.combinedParts).toBeGreaterThan(0);expect(diagnostics.drawCalls).toBeGreaterThan(0);
  console.log('Boss gallery rendering:',JSON.stringify(diagnostics));
  await page.screenshot({path:info.outputPath('five-boss-designs.png')});
  expect(errors).toEqual([]);
});

test('rescued crew, flying courier and rare creatures render at the growing base',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Math.random=()=>0;localStorage.setItem('earnly.spuddyEvolution.v1',JSON.stringify({version:1,bank:500,crew:{rescued:[true,true,true,true,true],transit:12},levels:{courier:2,roots:2}}));});
 await page.goto('/spuddy-evolution.html');await expect(page.locator('#start')).toBeEnabled();await page.locator('#start').click();await page.screenshot({path:info.outputPath('crew-home.png')});
 await page.locator('#upgrades').click();await page.locator('#journeyButton').click();await expect(page.locator('#crewCount')).toHaveText('5/5');await page.locator('#crewCount').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('crew-journey.png')});expect(errors).toEqual([]);
});

test('upgrade previews and Root Focus fit the phone and persist purchases',async({page},info)=>{
 await page.setViewportSize({width:320,height:568});
 await page.addInitScript(()=>{if(!localStorage.getItem('earnly.spuddyEvolution.v1'))localStorage.setItem('earnly.spuddyEvolution.v1',JSON.stringify({version:1,bank:200}));});
 await page.goto('/spuddy-evolution.html');await expect(page.locator('#start')).toBeEnabled();await page.locator('#start').click();await page.locator('#upgrades').click();
 await expect(page.locator('#upgradeList')).toContainText('Carry: 24 → 36 seeds');
 const focus=page.locator('.upgrade').filter({hasText:'Root Focus'});await focus.scrollIntoViewIfNeeded();await expect(focus).toContainText('0 → 15%');
 await focus.getByRole('button').click();await expect(focus).toContainText('15 → 30%');await expect(page.locator('#panelBank')).toHaveText('145');
 const box=await focus.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);
 await page.screenshot({path:info.outputPath('root-focus-upgrades.png')});
 await page.reload();await page.locator('#start').click();await page.locator('#upgrades').click();await expect(page.locator('.upgrade').filter({hasText:'Root Focus'})).toContainText('1/3');
});

test('Evolution Lab shows materials, buys an ability and preserves it on phone reload',async({page},info)=>{
 await page.setViewportSize({width:320,height:568});
 await page.addInitScript(()=>{if(!localStorage.getItem('earnly.spuddyEvolution.v1'))localStorage.setItem('earnly.spuddyEvolution.v1',JSON.stringify({version:1,bosses:[true]}));});
 await page.goto('/spuddy-evolution.html');await expect(page.locator('#start')).toBeEnabled();await page.locator('#start').click();await page.locator('#upgrades').click();await page.locator('#journeyButton').click();
 const card=page.locator('.lab-card').first();await card.scrollIntoViewIfNeeded();await expect(card).toContainText('Thorn seed: 1');await card.getByRole('button').click();await expect(card).toContainText('Thorn renewal · 1/3');await expect(card.getByRole('button')).toBeDisabled();await expect(page.locator('#labCount')).toHaveText('1/15');
 const box=await card.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);await page.screenshot({path:info.outputPath('evolution-lab-phone.png')});
 await page.reload();await page.locator('#start').click();await page.locator('#upgrades').click();await page.locator('#journeyButton').click();await expect(page.locator('.lab-card').first()).toContainText('Thorn seed: 0');await expect(page.locator('#labCount')).toHaveText('1/15');
});


for(const state of ['guardian','seeds','ready'])test('door explains '+state+' and offers the right action at 320px',async({page},info)=>{
 await page.setViewportSize({width:320,height:568});
 await page.route('**/spuddy-evolution-engine.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`;{const original=SpuddyEvolution.create;SpuddyEvolution.create=function(){const g=original({version:1,bank:${state==='ready'?80:30},bosses:[${state!=='guardian'}]});g.s.x=0;g.s.z=-15;g.s.enemies=[];window.doorTestGame=g;return g;};}`});});
 await page.goto('/spuddy-evolution.html');await expect(page.locator('#start')).toBeEnabled();await page.locator('#start').click();
 const prompt=page.locator('#nearGate');await expect(prompt).toBeVisible();await expect(prompt).toContainText('Prism Laboratory');const box=await prompt.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);expect(box.height).toBeGreaterThanOrEqual(44);
 await prompt.click();await expect(page.getByRole('dialog',{name:'Prism Laboratory'})).toBeVisible();
 await expect(page.locator('#gateExplanation')).toContainText(state==='guardian'?'Defeat Thorn Warden':state==='seeds'?'Bank 50 more':'Ready');
 await page.screenshot({path:info.outputPath('door-'+state+'-phone.png')});
 await page.locator('#gateAction').click();await expect(page.locator('#gatePanel')).not.toBeVisible();
 if(state==='ready'){await expect(prompt).toContainText('OPEN');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('earnly.spuddyEvolution.v1')).unlocked)).toBe(1);await expect(page.locator('#bank')).toHaveText('0');await page.screenshot({path:info.outputPath('door-open-phone.png')});}
 else await expect(page.locator('#toast')).toContainText(state==='guardian'?'Thorn Warden':'nest');
});

for(const width of [320,390])test('compact boss HUD and clear progression at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:690});
 await page.route('**/spuddy-evolution-engine.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`;{const original=SpuddyEvolution.create;SpuddyEvolution.create=function(){const g=original({version:1,bank:225,xp:360});g.s.z=-8;g.s.enemies=g.s.enemies.filter(e=>e.boss&&e.zone===0);return g;};}`});});
 await page.goto('/spuddy-evolution.html');await expect(page.locator('#start')).toBeEnabled();await page.locator('#start').click();
 await expect(page.locator('#bossHud')).toBeVisible();await expect(page.locator('#xpText')).toHaveText('XP LEVEL 5');await expect(page.locator('#evolutionHint')).toHaveText('0/5 upgrades to evolve');await expect(page.locator('#upgradeLabel')).toContainText('upgrade ready');
 const boss=await page.locator('#bossHud').boundingBox(),hud=await page.locator('.hud').boundingBox();expect(boss.height).toBeLessThanOrEqual(58);expect(boss.y).toBeGreaterThanOrEqual(hud.y+hud.height);expect(boss.x+boss.width).toBeLessThanOrEqual(width);await page.screenshot({path:info.outputPath('compact-boss-'+width+'.png')});
 await page.locator('#upgrades').click();await expect(page.locator('.progression-help')).toContainText('XP levels earn free perks');await expect(page.locator('.progression-help')).toContainText('Buying 5 upgrades evolves your body');await page.screenshot({path:info.outputPath('progression-help-'+width+'.png')});
});

test('critical health wins over cargo and courier hints without floating over combat',async({page},info)=>{
 await page.setViewportSize({width:320,height:568});
 await page.route('**/spuddy-evolution-engine.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`;{const original=SpuddyEvolution.create;SpuddyEvolution.create=function(){const g=original({version:1,crew:{transit:12},levels:{courier:1}});g.s.z=-7;g.s.hp=20;g.s.cargo=24;g.s.enemies=[];g.step=()=>{};return g;};}`});});
 await page.goto('/spuddy-evolution.html');await page.locator('#start').click();await expect(page.locator('#hint')).toContainText('Health low');await expect(page.locator('#healthReadout')).toHaveText('♥ 20 / 100');await expect(page.locator('#home')).toHaveClass(/needs-return/);
 const warning=await page.locator('#lowHealth').boundingBox(),cargo=await page.locator('.cargo').boundingBox();expect(warning.y).toBeGreaterThanOrEqual(cargo.y);expect(warning.y+warning.height).toBeLessThanOrEqual(cargo.y+cargo.height);await page.screenshot({path:info.outputPath('critical-health-phone.png')});
 await page.locator('#upgrades').click();await expect(page.locator('[data-upgrade="power"] .seed-shortage')).toHaveText('Bank 18 more seeds');await page.screenshot({path:info.outputPath('upgrade-shortages-phone.png')});
});
