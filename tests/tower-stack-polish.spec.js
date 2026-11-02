const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
 await page.route('https://**',r=>r.abort());await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off')});await page.goto('/towerstack.html');
});
async function start(page){await page.evaluate(()=>{Arcade.countdown=fn=>fn();startGame()});await expect(page.locator('#gameStatus')).toHaveText('Running')}
async function place(page,offset=0){await page.evaluate(offset=>{moving.x=blocks.at(-1).x+offset;placeBlock()},offset);await expect.poll(()=>page.evaluate(()=>placementLocked)).toBe(false)}
for(const path of ['/towerstack.html','/www/towerstack.html']){
 test('Skyline keeps five-pixel perfect snaps and visible falling offcuts '+path,async({page})=>{
  await page.goto(path);await start(page);await place(page,5);
  expect(await page.evaluate(()=>({floors,perfects,width:blocks.at(-1).w,chain:perfectChain}))).toEqual({floors:1,perfects:1,width:190,chain:1});
  await page.evaluate(()=>{moving.x=blocks.at(-1).x+20;placeBlock();placeBlock()});
  expect(await page.evaluate(()=>({floors,perfects,width:blocks.at(-1).w,cut:falling.at(-1).w}))).toEqual({floors:2,perfects:1,width:170,cut:20});
  await expect.poll(()=>page.evaluate(()=>placementLocked)).toBe(false);
  await expect(page.locator('#widthPreview')).toHaveText('89');
 });
}
test('camera climbs, districts unlock, and render history stays bounded on a deep run',async({page})=>{
 await start(page);
 await page.evaluate(()=>{cancelAnimationFrame(animation);animation=null;for(let i=0;i<105;i++){moving.x=blocks.at(-1).x;placeBlock();updateVisuals(160)}draw()});
 expect(await page.evaluate(()=>({floors,perfects,history:blocks.length,zone:TowerStackEngine.district(floors).name,screenY:blocks.at(-1).y+camera}))).toMatchObject({floors:105,perfects:105,zone:'Orbit'});
 expect(await page.evaluate(()=>blocks.length)).toBeLessThan(22);expect(await page.evaluate(()=>Math.abs(blocks.at(-1).y+camera-178))).toBeLessThan(10);
 await expect(page.locator('#heightPreview')).toHaveText('315');
 expect(await page.evaluate(()=>[rewardFor(12,9),rewardFor(33,33),rewardFor(36,36),rewardFor(500,500)])).toEqual([4,16,17,100]);
});
test('pause freezes floor movement, landing, offcuts and camera with no resume jump',async({page})=>{
 await start(page);await page.evaluate(()=>{moving.x=blocks.at(-1).x+16;placeBlock()});await page.locator('#earnlyPauseButton').click();
 const before=await page.evaluate(()=>JSON.stringify({x:moving.x,camera,landing,falling}));await page.waitForTimeout(350);
 expect(await page.evaluate(()=>JSON.stringify({x:moving.x,camera,landing,falling}))).toBe(before);
 await page.locator('#earnlyPauseButton').click();await expect.poll(()=>page.evaluate(()=>placementLocked)).toBe(false);
 expect(await page.evaluate(()=>Number.isFinite(moving.x)&&Number.isFinite(camera))).toBe(true);
});
test('complete miss ends once, gives one result screen, and replay resets the skyline',async({page})=>{
 await start(page);await place(page);
 await page.evaluate(()=>{window.saves=0;const record=Arcade.recordResult;Arcade.recordResult=(...args)=>{window.saves++;return record(...args)};moving.x=360;placeBlock();finishGame()});
 await expect(page.locator('dialog[open]')).toContainText('Floors Stacked');expect(await page.evaluate(()=>saves)).toBe(1);
 await page.locator('dialog[open]').getByRole('button',{name:/Play Again/}).click();
 await expect.poll(()=>page.evaluate(()=>({floors,perfects,perfectChain,camera,running}))).toEqual({floors:0,perfects:0,perfectChain:0,camera:0,running:true});
});
test('Space and pointer input place once and held keys do not repeat',async({page})=>{
 await start(page);await page.evaluate(()=>{moving.x=blocks.at(-1).x});await page.locator('body').press('Space');await expect(page.locator('#floors')).toHaveText('1');
 await expect.poll(()=>page.evaluate(()=>placementLocked)).toBe(false);
 await page.evaluate(()=>{moving.x=blocks.at(-1).x;document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',repeat:true,bubbles:true}))});await expect(page.locator('#floors')).toHaveText('1');
});
test('all skyline content and session controls fit portrait and landscape',async({page},info)=>{
 for(const [width,height] of [[320,568],[390,664],[390,844],[440,956],[667,375],[844,390]]){
  await page.evaluate(()=>localStorage.clear());await page.setViewportSize({width,height});await page.goto('/towerstack.html');await start(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  for(const selector of ['#game','#towerInfo','#rewardTarget','#towerControls']){
   const box=await page.locator(selector).boundingBox();expect(box.y,selector).toBeGreaterThanOrEqual(0);expect(box.y+box.height,selector).toBeLessThanOrEqual(height);
  }
  const board=await page.locator('#game').boundingBox(),controls=await page.locator('#towerControls').boundingBox();
  if(width<height)expect(board.y+board.height).toBeLessThan(controls.y);
  else expect(board.x+board.width).toBeLessThan(controls.x);
  await page.evaluate(()=>{cancelAnimationFrame(animation);animation=null;for(let i=0;i<18;i++){moving.x=blocks.at(-1).x+(i%5===0?7:0);placeBlock();updateVisuals(160)}draw()});
  await page.screenshot({path:info.outputPath('tower-stack-'+width+'x'+height+'.png')});
 }
});
test('reduced motion keeps precision and score without decorative particles',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await start(page);await place(page);
 expect(await page.evaluate(()=>({floors,perfects,sparks:sparks.length,rings:rings.length}))).toEqual({floors:1,perfects:1,sparks:0,rings:0});
});
