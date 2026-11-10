const {test,expect}=require('@playwright/test');
const {seedCollectionFixture}=require('./spuddy-evolution-fixtures.cjs');
const url='/spuddy-evolution.html';

// Observe the real engine; do not stub movement, capture, banking or storage.
async function observeGame(page,fixture=null){
 await page.route('**/spuddy-evolution-engine.js*',async route=>{
  const response=await route.fetch();
  const setup=fixture?'('+fixture.toString()+')(g);':'';
  await route.fulfill({response,body:(await response.text())+`\n;{const create=SpuddyEvolution.create;SpuddyEvolution.create=function(...args){const g=create(...args);${setup}window.evolutionTest=g;return g;};}`});
 });
}

test.use({launchOptions:{args:process.env.EVOLUTION_CHROMIUM_3D==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]}});
test.setTimeout(120000);
test('onboarding, rendered world and controls fit small and tall phones',async({page},testInfo)=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(size);await page.goto(url);await expect(page.locator('#start')).toBeVisible();await expect(page.locator('#start')).toBeEnabled({timeout:15000});await page.locator('#start').click();await expect(page.locator('#intro')).not.toBeVisible();await expect(page.locator('#world')).toHaveAttribute('data-renderer','webgl-3d');for(const id of ['pause','camera','upgrades','home','pulse']){const b=await page.locator('#'+id).boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(size.width);expect(b.y+b.height).toBeLessThanOrEqual(size.height);expect(b.height).toBeGreaterThanOrEqual(44);}await page.screenshot({path:testInfo.outputPath('evolution-'+size.width+'.png')});}expect(errors).toEqual([]);});
test('keyboard movement captures seeds, nest banks them, save survives reload',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await observeGame(page,seedCollectionFixture);
 await page.goto(url);
 await expect(page.locator('#start')).toBeVisible();
 await expect(page.locator('#start')).toBeEnabled({timeout:15000});
 await page.locator('#start').click();
 await expect(page.locator('#world')).toHaveAttribute('data-renderer','webgl-3d');
 await expect(page.locator('#bank')).toHaveText('0');

 // Hold real keyboard input until the game confirms a capture, not for an
 // assumed number of rendered frames. The target is outside nest bank range.
 await page.keyboard.down('ArrowUp');
 try {
  await expect.poll(()=>page.evaluate(()=>evolutionTest.s.cargo),{timeout:15000}).toBe(3);
 } finally { await page.keyboard.up('ArrowUp'); }
 expect(await page.evaluate(()=>evolutionTest.s.z)).toBeLessThan(6);
 await expect(page.locator('#cargo')).toHaveText('Pouch 3 / 24');
 await expect(page.locator('#bank')).toHaveText('0');

 await page.keyboard.down('ArrowDown');
 try {
  await expect(page.locator('#bank')).toHaveText('3',{timeout:15000});
 } finally { await page.keyboard.up('ArrowDown'); }
 await expect(page.locator('#cargo')).toHaveText('Pouch 0 / 24');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('earnly.spuddyEvolution.v1')));
 expect(saved).toMatchObject({bank:3,deposited:3,journey:{captures:1,banked:3}});
 await page.reload();
 await expect(page.locator('#start')).toBeEnabled({timeout:15000});
 await page.locator('#start').click();
 await expect(page.locator('#bank')).toHaveText('3');
 await expect(page.locator('#cargo')).toHaveText('Pouch 0 / 24');
 expect(await page.evaluate(()=>evolutionTest.exportSave())).toMatchObject({bank:3,deposited:3,journey:{captures:1,banked:3}});
 expect(errors).toEqual([]);
});
test('upgrades spend saved seeds and persist, gate cannot bypass bosses',async({page})=>{await page.addInitScript(()=>localStorage.setItem('earnly.spuddyEvolution.v1',JSON.stringify({version:1,bank:100})));await page.goto(url);await expect(page.locator('#start')).toBeEnabled({timeout:15000});await page.locator('#start').click();await page.locator('#upgrades').click();await page.getByRole('button',{name:'Upgrade Root power for 18 seeds',exact:true}).click();await expect(page.locator('#panelBank')).toHaveText('82');await expect(page.locator('#gate')).toBeDisabled();await page.locator('#closePanel').click();await expect(page.locator('#bank')).toHaveText('82');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('earnly.spuddyEvolution.v1')).levels.power)).toBe(1);});
test('pause, background pause, resume and burst cooldown work',async({page})=>{
 await observeGame(page);
 await page.goto(url);
 await expect(page.locator('#start')).toBeEnabled({timeout:15000});
 await page.locator('#start').click();
 await page.locator('#pulse').click();
 await expect(page.locator('#pulse')).toBeDisabled();
 await page.locator('#pause').click();
 await expect(page.locator('#pausePanel')).toBeVisible();
 const before=await page.evaluate(()=>({paused:evolutionTest.s.paused,time:evolutionTest.s.time,cooldown:evolutionTest.s.cooldown}));
 expect(before.paused).toBe(true);
 expect(before.cooldown).toBeGreaterThan(0);
 // The HUD refreshes separately from physics. First require it to display the
 // actual frozen cooldown; sampling an old frame can read 7 instead of 6.
 await expect(page.locator('#burstStatus')).toHaveText(Math.ceil(before.cooldown)+'s remaining');
 const text=await page.locator('#pulse').textContent();
 // Intentional observation interval: a ten-second pause must freeze a
 // seven-second cooldown. This is not used to guess movement or readiness.
 await page.waitForTimeout(10000);
 expect(await page.evaluate(()=>({paused:evolutionTest.s.paused,time:evolutionTest.s.time,cooldown:evolutionTest.s.cooldown}))).toEqual(before);
 await expect(page.locator('#pulse')).toHaveText(text);
 await page.locator('#resume').click();
 await expect(page.locator('#pausePanel')).not.toBeVisible();
 await expect(page.locator('#pulse')).toBeEnabled({timeout:12000});
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await expect(page.locator('#pausePanel')).toBeVisible();
 expect(await page.evaluate(()=>evolutionTest.s.paused)).toBe(true);
 await page.locator('#resume').click();
 await expect(page.locator('#pausePanel')).not.toBeVisible();
 expect(await page.evaluate(()=>evolutionTest.s.paused)).toBe(false);
});
test('drag input releases cleanly and upgrades remain usable',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto(url);await expect(page.locator('#start')).toBeEnabled({timeout:15000});await page.locator('#start').click();await page.mouse.move(190,500);await page.mouse.down();await page.mouse.move(190,400,{steps:10});await expect(page.locator('#joystick')).toBeVisible();await page.mouse.up();await expect(page.locator('#joystick')).not.toBeVisible();await page.locator('#upgrades').click();await expect(page.locator('#panel')).toBeVisible();await page.locator('#closePanel').click();await page.locator('#home').click();await expect(page.locator('#toast')).toContainText(/green arrow|safe at the nest/);});

test('real WebGL renderer rotates, free perks apply once, and old saves migrate',async({page},testInfo)=>{await page.addInitScript(()=>localStorage.setItem('earnly.spuddyEvolution.v1',JSON.stringify({version:1,bank:100,xp:90,bosses:[true,true,true],unlocked:2,levels:{power:5}})));await page.goto(url);await expect(page.locator('#start')).toBeEnabled({timeout:15000});await page.locator('#start').click();await expect(page.locator('#world')).toHaveAttribute('data-renderer','webgl-3d');const gl=await page.locator('#world').evaluate(c=>{const g=c.getContext('webgl2');return g?g.getParameter(g.VERSION):null});expect(gl).toContain('WebGL 2');await page.locator('#camera').click();await expect(page.locator('#toast')).toContainText('View rotated');await page.locator('#perkButton').click();await page.locator('[data-perk="vigor"]').click();await expect(page.locator('#perkPanel')).not.toBeVisible();await expect(page.locator('#perkButton')).not.toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('earnly.spuddyEvolution.v1')).perks)).toEqual(['vigor']);await page.screenshot({path:testInfo.outputPath('evolution-3d-evolved-rotated.png')});});
test('unsupported graphics produces a clear non-playable explanation',async({page})=>{await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type.startsWith('webgl'))return null;return original.call(this,type,...args)}});await page.goto(url);await expect(page.locator('#start')).toBeDisabled();await expect(page.locator('#intro')).toContainText('could not start WebGL 3D');});

test('journey advances completed saves and research survives reload',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('earnly.spuddyEvolution.v1'))localStorage.setItem('earnly.spuddyEvolution.v1',JSON.stringify({version:1,bank:100,bosses:[true,true,true,true,true],unlocked:4,journey:{chapter:1,shards:5}}));});
 await page.goto(url);await expect(page.locator('#start')).toBeEnabled({timeout:15000});await page.locator('#start').click();await page.locator('#upgrades').click();await page.locator('#journeyButton').click();
 await page.getByRole('button',{name:'Research Ancient roots',exact:true}).click();await expect(page.locator('#shards')).toHaveText('✧ 3');await page.locator('#nextChapter').click();await expect(page.locator('#journeyPanel')).not.toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('earnly.spuddyEvolution.v1')));expect(saved.journey.chapter).toBe(2);expect(saved.journey.research.power).toBe(1);expect(saved.bank).toBe(100);
 await page.reload();await page.locator('#start').click();await page.locator('#upgrades').click();await page.locator('#journeyButton').click();await expect(page.locator('#chapterTitle')).toHaveText('Expedition 2 / 100');await expect(page.locator('#nextChapter')).toBeDisabled();
});

test('workshop categories keep upgrades reachable and preserve purchases on small phones',async({page},testInfo)=>{
 await page.addInitScript(()=>localStorage.setItem('earnly.spuddyEvolution.v1',JSON.stringify({version:1,bank:100})));
 for(const width of [320,390]){
  await page.setViewportSize({width,height:740});await page.goto(url);await expect(page.locator('#start')).toBeEnabled({timeout:15000});await page.locator('#start').click();await page.locator('#upgrades').click();
  await expect(page.locator('#upgradeList .upgrade:visible')).toHaveCount(9);
  await page.getByRole('button',{name:'Combat',exact:true}).click();await expect(page.locator('#upgradeList .upgrade:visible')).toHaveCount(4);
  await page.getByRole('button',{name:'Explore',exact:true}).click();await expect(page.locator('#upgradeList .upgrade:visible')).toHaveCount(3);
  await page.getByRole('button',{name:'Upgrade Seed pouch for 16 seeds',exact:true}).click();await expect(page.locator('#panelBank')).toHaveText('84');await expect(page.getByRole('button',{name:'Explore',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('#purchaseStatus')).toContainText('Seed pouch upgraded to rank 1');
  await page.getByRole('button',{name:'Helpers',exact:true}).click();await expect(page.locator('#upgradeList .upgrade:visible')).toHaveCount(2);await expect(page.locator('[data-upgrade="courier"] button')).toBeDisabled();await expect(page.locator('#shopAvailable')).toHaveText('1 available');
  expect(await page.locator('#panel').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  for(const button of await page.locator('#upgradeFilters button').all()){const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);}
  await page.screenshot({path:testInfo.outputPath('workshop-'+width+'.png')});
  await page.locator('#closePanel').click();await expect(page.locator('#cargo')).toHaveText('Pouch 0 / 36');
 }
});
