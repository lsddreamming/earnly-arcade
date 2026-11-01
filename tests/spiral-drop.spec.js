const {test,expect}=require('@playwright/test');
async function open(page,path='/mini.html?game=spiralDrop'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-01T12:00:00Z')});
 await page.route('https://**',r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');localStorage.setItem('spiralDropBest','97');});
 await page.route('**/spiral-drop-engine.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+`;const originalSpiralCreate=SpiralDropEngine.create;SpiralDropEngine.create=(...args)=>{const game=originalSpiralCreate(...args);game.state.wait=1e9;window.testSpiral=game;return game;};`});});
 await page.goto(path);await page.clock.pauseAt(new Date('2026-11-01T12:02:00Z'));
 await page.evaluate(()=>{Arcade.countdown=fn=>fn();});
 await page.locator('#startButton').click();await page.clock.runFor(50);
 await expect(page.locator('#surface canvas')).toBeVisible();
 return errors;
}
for(const path of ['/mini.html?game=spiralDrop','/www/mini.html?game=spiralDrop']){
 test('Spiral Drop relative dragging never jumps, clamps accurately and releases '+path,async({page})=>{
  const errors=await open(page,path);
  const state=await page.evaluate(()=>{
   const c=document.querySelector('#surface canvas'),width=c.getBoundingClientRect().width,g=testSpiral;
   const send=(name,x,id=7,primary=true)=>c.dispatchEvent(new PointerEvent(name,{pointerId:id,isPrimary:primary,clientX:x,clientY:150,button:0,pointerType:'touch',bubbles:true,cancelable:true}));
   send('pointerdown',300);const first=g.state.x;send('pointermove',320);const moved=g.state.x;send('pointermove',5000);const edge=g.state.x;send('pointermove',4990);const reverse=g.state.x;send('pointercancel',4990);send('pointermove',4700);const released=g.state.x;send('pointerdown',200,8,false);send('pointermove',100,8,false);return {first,moved,edge,reverse,released,secondary:g.state.x,width};
  });
  expect(state.first).toBe(180);expect(state.moved).toBeCloseTo(180+20*360/state.width,2);expect(state.edge).toBe(336);expect(state.reverse).toBeCloseTo(336-10*360/state.width,2);expect(state.released).toBe(state.reverse);expect(state.secondary).toBe(state.reverse);
  await page.locator('#earnlyPauseButton').click();const before=await page.evaluate(()=>({x:testSpiral.state.x,ticks:testSpiral.state.ticks,y:testSpiral.state.y}));
  await page.clock.runFor(10000);await page.keyboard.down('ArrowLeft');await page.clock.runFor(300);await page.keyboard.up('ArrowLeft');
  expect(await page.evaluate(()=>({x:testSpiral.state.x,ticks:testSpiral.state.ticks,y:testSpiral.state.y}))).toEqual(before);
  await page.getByRole('button',{name:/Resume/}).click();await page.clock.runFor(50);expect(await page.evaluate(()=>testSpiral.state.x)).toBe(before.x);
  await page.keyboard.down('ArrowLeft');await page.clock.runFor(200);await page.keyboard.up('ArrowLeft');expect(await page.evaluate(()=>testSpiral.state.x)).toBeLessThan(before.x-50);
  expect(errors).toEqual([]);
 });
 test('Spiral Drop actual centered clears, Flow, settlement and historical best '+path,async({page})=>{
  const errors=await open(page,path);
  for(let i=0;i<3;i++){
   await page.evaluate(i=>{const s=testSpiral.state;s.wait=0;s.x=180;s.vy=88;const y=s.y+13;s.rows=[{id:i,y,gap:180,w:100,passed:false}];},i);
   await page.clock.runFor(600);
  }
  expect(await page.evaluate(()=>({score:testSpiral.state.score,centered:testSpiral.state.centered,bestStreak:testSpiral.state.bestStreak}))).toEqual({score:3,centered:3,bestStreak:3});
  await expect(page.locator('.spiral-feedback')).toContainText('FLOW');
  await page.evaluate(()=>{window.spiralAwards=[];Arcade.earn=(amount,label,evidence)=>spiralAwards.push({amount,evidence});const s=testSpiral.state;s.score=19;s.x=30;s.wait=0;s.rows=[{id:20,y:s.y+13,gap:180,w:100,passed:false}];});
  await page.clock.runFor(500);
  const dialog=page.locator('dialog.game-result-dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('.result-outcome')).toContainText('Next dive goal');
  expect(await page.evaluate(()=>spiralAwards)).toEqual([{amount:12,evidence:{kind:'game',game:'spiralDrop',metric:19}}]);expect(await page.evaluate(()=>Arcade.best('spiralDrop').value)).toBe(97);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('spiralDropMedals')))).toContain('Flow navigator');
  const ticks=await page.evaluate(()=>testSpiral.state.ticks);await page.clock.runFor(1000);await page.keyboard.press('ArrowRight');expect(await page.evaluate(()=>testSpiral.state.ticks)).toBe(ticks);
  await dialog.getByRole('button',{name:/Play Again/}).click();await page.clock.runFor(50);expect(await page.evaluate(()=>({score:testSpiral.state.score,centered:testSpiral.state.centered,alive:testSpiral.state.alive}))).toEqual({score:0,centered:0,alive:true});
  expect(errors).toEqual([]);
 });
}
test('Spiral Drop fills phone and desktop screens with visible controls and readable lookahead',async({page})=>{
 const errors=await open(page);
 for(const size of [{width:320,height:568},{width:390,height:844},{width:440,height:956},{width:667,height:375},{width:1363,height:936},{width:1024,height:600}]){
  await page.setViewportSize(size);await page.clock.runFor(50);
  for(const selector of ['#surface canvas','.spiral-control-zone','#earnlyPauseButton','#earnlyQuitButton'])await expect(page.locator(selector)).toBeInViewport();
  expect(await page.locator('#earnlyQuitButton').count()).toBe(1);await expect(page.locator('#miniGameExit')).toBeHidden();
  const boxes=await page.evaluate(()=>{const selectors=['#surface canvas','.spiral-route','.spiral-control-zone','.spiral-session-controls'];return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,items:selectors.map(q=>{const r=document.querySelector(q).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})};});
  expect(boxes.scrollWidth).toBeLessThanOrEqual(boxes.width+1);expect(boxes.items[0].h).toBeGreaterThan(140);expect(360*boxes.items[0].h/boxes.items[0].w).toBeGreaterThan(280);
  for(let i=1;i<boxes.items.length;i++){const a=boxes.items[i-1],b=boxes.items[i];expect(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h-1&&a.y+a.h>b.y+1).toBe(false);}
 }
 await page.setViewportSize({width:390,height:844});await page.clock.runFor(50);await page.screenshot({path:test.info().outputPath('spiral-drop-phone.png')});
 await page.setViewportSize({width:667,height:375});await page.clock.runFor(50);await page.screenshot({path:test.info().outputPath('spiral-drop-landscape.png')});
 expect(errors).toEqual([]);
});
test('Spiral Drop orb genuinely descends and lets the camera follow it',async({page})=>{
 await open(page);const initial=await page.evaluate(()=>({y:testSpiral.state.y,vy:testSpiral.state.vy}));
 await page.evaluate(()=>{testSpiral.state.wait=0;testSpiral.state.rows=[];});await page.clock.runFor(1000);
 const fallen=await page.evaluate(()=>({y:testSpiral.state.y,vy:testSpiral.state.vy}));expect(fallen.y).toBeGreaterThan(initial.y+50);expect(fallen.vy).toBeGreaterThan(initial.vy+70);
 await page.clock.runFor(1000);expect(await page.evaluate(()=>testSpiral.state.y)).toBeGreaterThan(fallen.y+80);
});
