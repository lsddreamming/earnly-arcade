const {test,expect}=require('@playwright/test');
async function open(page,path='/mini.html?game=perfectDrop',countdown=false){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-01T12:00:00Z')});
 await page.route('https://**',r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');localStorage.setItem('perfectDropBest','60');});
 await page.route('**/perfect-drop-engine.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+`;const originalPerfectCreate=PerfectDropEngine.create;PerfectDropEngine.create=(...args)=>{const game=originalPerfectCreate(...args);window.testPerfect=game;return game;};`});});
 await page.goto(path);await page.clock.pauseAt(new Date('2026-11-01T12:02:00Z'));
 if(!countdown)await page.evaluate(()=>{Arcade.countdown=fn=>fn();});
 await page.screenshot({path:test.info().outputPath('perfect-drop-launch.png')});
 await page.locator('#startButton').click();await page.clock.runFor(countdown?2300:50);
 await expect(page.locator('#surface canvas')).toBeVisible();return errors;
}
for(const path of ['/mini.html?game=perfectDrop','/www/mini.html?game=perfectDrop']){
 test('Perfect Drop one tap commits, double taps and held keys cannot queue extra drops '+path,async({page})=>{
  const errors=await open(page,path);
  await page.evaluate(()=>{const s=testPerfect.state;s.x=s.round.center;});
  if(test.info().project.name==='mobile-webkit')await page.locator('.perfect-drop-action').tap();else await page.locator('.perfect-drop-action').click();
  expect(await page.evaluate(()=>testPerfect.state.phase)).toBe('flight');
  await page.evaluate(()=>{const c=document.querySelector('#surface canvas');for(let i=0;i<4;i++){c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:10+i,isPrimary:i===0,pointerType:'touch',bubbles:true,cancelable:true}));c.dispatchEvent(new PointerEvent('pointerup',{pointerId:10+i,isPrimary:i===0,pointerType:'touch',bubbles:true}));}document.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',repeat:true,bubbles:true,cancelable:true}));});
  await page.clock.runFor(1100);expect(await page.evaluate(()=>({hits:testPerfect.state.hits,attempts:testPerfect.state.attempts,perfects:testPerfect.state.perfects,phase:testPerfect.state.phase}))).toEqual({hits:1,attempts:1,perfects:1,phase:'aim'});
  await page.evaluate(()=>{testPerfect.state.x=testPerfect.state.round.center;});await page.keyboard.down('Space');await page.clock.runFor(1300);await page.keyboard.up('Space');await page.clock.runFor(100);
  expect(await page.evaluate(()=>testPerfect.state.attempts)).toBe(2);expect(await page.evaluate(()=>testPerfect.state.hits)).toBe(2);
  await page.evaluate(()=>{const c=document.querySelector('#surface canvas');c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:30,isPrimary:false,pointerType:'touch',bubbles:true}));c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:31,isPrimary:true,pointerType:'mouse',button:2,bubbles:true}));});expect(await page.evaluate(()=>testPerfect.state.phase)).toBe('aim');
  expect(errors).toEqual([]);
 });
 test('Perfect Drop Skyfire stays cosmetic and settlement preserves rewards and historical best '+path,async({page})=>{
  const errors=await open(page,path);
  for(let i=0;i<3;i++){await page.evaluate(()=>{testPerfect.state.x=testPerfect.state.round.center;testPerfect.commit();});await page.clock.runFor(1050);}
  expect(await page.evaluate(()=>({hits:testPerfect.state.hits,perfects:testPerfect.state.perfects,chain:testPerfect.state.bestPerfectChain}))).toEqual({hits:3,perfects:3,chain:3});await expect(page.locator('.perfect-charge strong')).toHaveText('SKYFIRE ● ● ●');
  await page.evaluate(()=>{window.perfectAwards=[];Arcade.earn=(amount,label,evidence)=>perfectAwards.push({amount,evidence});Object.assign(testPerfect.state,{hits:19,attempts:19,lives:1,aimTime:testPerfect.state.round.limit});});
  await page.clock.runFor(600);
  const dialog=page.locator('dialog.game-result-dialog');await expect(dialog).toBeVisible();await expect(dialog).toContainText('SKYFIRE PILOT');await expect(dialog.locator('.result-outcome')).toContainText('Next goal: 20 hits');
  expect(await page.evaluate(()=>perfectAwards)).toEqual([{amount:52,evidence:{kind:'game',game:'perfectDrop',metric:19}}]);expect(await page.evaluate(()=>Arcade.best('perfectDrop').value)).toBe(60);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('perfectDropMedals')))).toContain('Skyfire pilot');
  const ticks=await page.evaluate(()=>testPerfect.state.ticks);await page.clock.runFor(1000);await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true})));expect(await page.evaluate(()=>testPerfect.state.ticks)).toBe(ticks);expect(await page.evaluate(()=>perfectAwards.length)).toBe(1);
  await dialog.getByRole('button',{name:/Play Again/}).click();await expect.poll(async()=>{await page.clock.runFor(50);return page.evaluate(()=>({hits:testPerfect.state.hits,perfects:testPerfect.state.perfects,lives:testPerfect.state.lives,phase:testPerfect.state.phase}));}).toEqual({hits:0,perfects:0,lives:3,phase:'aim'});
  expect(errors).toEqual([]);
 });
}
test('Perfect Drop countdown and pause freeze the rail, flight and deadline',async({page})=>{
 const errors=await open(page,'/mini.html?game=perfectDrop',true);await expect(page.locator('#gameStatus')).toHaveText('Running');expect(await page.evaluate(()=>testPerfect.state.aimTime)).toBeLessThan(.3);
 await page.locator('#earnlyPauseButton').click();const before=await page.evaluate(()=>({x:testPerfect.state.x,time:testPerfect.state.aimTime,lives:testPerfect.state.lives,ticks:testPerfect.state.ticks}));await page.clock.runFor(10000);await page.keyboard.press('Space');expect(await page.evaluate(()=>({x:testPerfect.state.x,time:testPerfect.state.aimTime,lives:testPerfect.state.lives,ticks:testPerfect.state.ticks}))).toEqual(before);
 await page.getByRole('button',{name:/Resume/}).click();await page.clock.runFor(100);await page.evaluate(()=>{testPerfect.state.x=testPerfect.state.round.center;testPerfect.commit();});await page.clock.runFor(150);await page.locator('#earnlyPauseButton').click();const flight=await page.evaluate(()=>({fall:testPerfect.state.fall,x:testPerfect.state.dropX,hits:testPerfect.state.hits}));await page.clock.runFor(10000);expect(await page.evaluate(()=>({fall:testPerfect.state.fall,x:testPerfect.state.dropX,hits:testPerfect.state.hits}))).toEqual(flight);
 await page.getByRole('button',{name:/Resume/}).click();await page.clock.runFor(500);expect(await page.evaluate(()=>testPerfect.state.hits)).toBe(1);expect(errors).toEqual([]);
});
test('Perfect Drop full screen controls fit small phones, large iPhones, landscape and desktop',async({page})=>{
 const errors=await open(page);await page.evaluate(()=>{testPerfect.advance=()=>[];});
 for(const size of [{width:320,height:568},{width:390,height:844},{width:440,height:956},{width:568,height:320},{width:667,height:375},{width:956,height:440},{width:1363,height:936},{width:1024,height:600}]){
  await page.setViewportSize(size);await page.clock.runFor(50);await page.screenshot({path:test.info().outputPath('perfect-drop-'+size.width+'x'+size.height+'.png')});
  for(const selector of ['#surface canvas','.perfect-drop-action','#earnlyPauseButton','#earnlyQuitButton'])await expect(page.locator(selector)).toBeInViewport();await expect(page.locator('.desktop-nav')).toBeHidden();await expect(page.locator('#miniGameExit')).toBeHidden();expect((await page.locator('.page-header').boundingBox()).y).toBeLessThan(60);expect(await page.locator('#earnlyQuitButton').count()).toBe(1);
  const boxes=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,items:['#surface canvas','.perfect-console','.perfect-drop-action','.perfect-session-controls'].map(q=>{const r=document.querySelector(q).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})}));expect(boxes.scrollWidth).toBeLessThanOrEqual(boxes.width+1);expect(boxes.items[0].h).toBeGreaterThan(size.height<450?110:140);
  for(let i=1;i<boxes.items.length;i++){const a=boxes.items[i-1],b=boxes.items[i];expect(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h-1&&a.y+a.h>b.y+1).toBe(false);}
 }
 expect(errors).toEqual([]);
});
