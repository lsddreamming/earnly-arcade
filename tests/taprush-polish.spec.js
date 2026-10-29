const {test,expect}=require('@playwright/test');

test.beforeEach(async({page})=>{
 await page.route('https://**',r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');});
});
async function start(page,prefix=''){
 await page.goto(prefix+'/taprush.html');
 await page.evaluate(()=>{Arcade.countdown=fn=>fn();});
 const button=page.locator('#startButton');
 if(await button.isVisible())await button.click();else await page.locator('#board').click();
 await expect(page.locator('#gameStatus')).toHaveText('Running');
 await expect(page.locator('#hits')).toHaveText('0');
}
async function press(page,x,y,isMobile){
 if(isMobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
}
async function hit(page){
 await page.evaluate(()=>{const r=target.getBoundingClientRect();board.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerType:'touch',bubbles:true,cancelable:true}));});
}
for(const prefix of ['', '/www']){
 test('Tap Rush scores green, moves clear of the last tap and penalizes background '+prefix,async({page,isMobile})=>{
  await start(page,prefix);
  const deadline=await page.evaluate(()=>roundEndsAt);
  let previous;
  for(let i=0;i<12;i++){
   const r=await page.locator('#target').boundingBox();
   if(previous)expect(Math.hypot(r.x-previous.x,r.y-previous.y)).toBeGreaterThanOrEqual(77);
   await press(page,r.x+r.width/2,r.y+r.height/2,isMobile);
   await expect(page.locator('#hits')).toHaveText(String(i+1));previous=r;
  }
  expect(await page.evaluate(()=>roundEndsAt)).toBe(deadline);
  // The old position is now dark background, as is the board corner.
  await press(page,previous.x+previous.width/2,previous.y+previous.height/2,isMobile);
  const box=await page.locator('#board').boundingBox();
  await press(page,box.x+8,box.y+box.height/2,isMobile);
  expect(await page.evaluate(()=>({hits,misses,deadline:roundEndsAt}))).toEqual({hits:12,misses:2,deadline:deadline-1500});
  await expect(page.locator('#rushNote')).toHaveText('Miss · −0.75s');
  await expect(page.locator('.game-guide-overlay')).toHaveClass(/hidden/);
 });
 test('Tap Rush accepts consecutive aimed presses within one frame without duplicate clicks '+prefix,async({page})=>{
  await start(page,prefix);
  const state=await page.evaluate(()=>{
   for(let i=0;i<100;i++){
    const r=target.getBoundingClientRect();
    target.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerType:'touch',pointerId:i%2+1,isPrimary:i%2===0,bubbles:true,cancelable:true}));
    target.dispatchEvent(new MouseEvent('click',{detail:1,bubbles:true}));
   }
   target.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'mouse',button:2,bubbles:true}));
   return {hits,misses,reward:rewardForHits(hits)};
  });
  expect(state).toEqual({hits:100,misses:0,reward:60});
 });
}
test('Tap Rush circle stays until hit and random positions span the board',async({page})=>{
 await page.clock.install();await start(page);
 const position=await page.locator('#target').boundingBox();
 await page.clock.fastForward(2000);
 expect(await page.locator('#target').boundingBox()).toEqual(position);
 const result=await page.evaluate(()=>{
  const positions=[];for(let i=0;i<200;i++){moveTarget();positions.push([parseFloat(target.style.left),parseFloat(target.style.top)]);}
  const old=Math.random;Math.random=()=>.5;
  target.style.left=board.clientWidth/2+'px';target.style.top=board.clientHeight/2+'px';
  const before=[parseFloat(target.style.left),parseFloat(target.style.top)];moveTarget();Math.random=old;
  return {positions,width:board.clientWidth,height:board.clientHeight,fallback:Math.hypot(parseFloat(target.style.left)-before[0],parseFloat(target.style.top)-before[1])};
 });
 expect(Math.min(...result.positions.map(p=>p[0]))).toBeLessThan(result.width*.25);
 expect(Math.max(...result.positions.map(p=>p[0]))).toBeGreaterThan(result.width*.75);
 expect(result.fallback).toBeGreaterThan(77);
});
test('Tap Rush background spam spends the clock without scoring or earning',async({page})=>{
 await start(page);
 await page.evaluate(()=>{for(let i=0;i<30&&running;i++)registerMiss();});
 await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
 expect(await page.evaluate(()=>({hits,earned:rewardForHits(hits)}))).toEqual({hits:0,earned:0});
});
test('Tap Rush keeps the full 20-second clock and ends exactly once',async({page})=>{
 await page.clock.install();await start(page);
 await page.evaluate(()=>{window.earnCalls=0;const earn=Arcade.earn;Arcade.earn=(...args)=>{window.earnCalls++;return earn(...args);};});
 await page.clock.fastForward(19000);
 await expect(page.locator('#gameStatus')).toHaveText('Running');
 await hit(page);
 await expect(page.locator('#hits')).toHaveText('1');
 await page.clock.fastForward(1100);
 await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
 await page.evaluate(()=>{registerTap();finishGame();updateTimer();});
 expect(await page.evaluate(()=>({hits,calls:window.earnCalls}))).toEqual({hits:1,calls:1});
});
test('Tap Rush rejects a press after the exact deadline before the timer tick',async({page})=>{
 await start(page);await page.locator('#target').click();
 await page.evaluate(()=>{roundEndsAt=performance.now()-1;const r=target.getBoundingClientRect();target.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerType:'touch',bubbles:true}));});
 await expect(page.locator('#hits')).toHaveText('1');
 await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
});
test('Tap Rush pause and Quit cancel preserve taps and the remaining clock',async({page})=>{
 await start(page);await page.locator('#target').click();
 await page.locator('#earnlyPauseButton').click();
 const frozen=await page.evaluate(()=>({hits,timeLeft}));
 await hit(page);
 await page.waitForTimeout(250);
 expect(await page.evaluate(()=>({hits,timeLeft}))).toEqual(frozen);
 await page.locator('#earnlyPauseButton').click();
 await page.locator('#earnlyQuitButton').click();
 await expect(page.locator('.earnly-quit-dialog')).toBeVisible();
 await page.locator('[data-keep]').click();
 await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.locator('#target').click();await expect(page.locator('#hits')).toHaveText('2');
});
test('Tap Rush transient blur keeps scoring while backgrounding pauses visibly',async({page})=>{
 await start(page);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.locator('#target').click();await expect(page.locator('#hits')).toHaveText('1');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.locator('#gameStatus')).toHaveText('Paused');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 await page.locator('#earnlyPauseButton').click();
 await page.locator('#target').click();await expect(page.locator('#hits')).toHaveText('2');
});
test('Tap Rush keyboard presses count once and holding does not auto-score',async({page})=>{
 await start(page);await page.locator('#target').focus();
 await page.keyboard.down('Space');await page.keyboard.down('Space');await page.keyboard.up('Space');
 await expect(page.locator('#hits')).toHaveText('1');
 await page.keyboard.press('Enter');await expect(page.locator('#hits')).toHaveText('2');
});
test('Tap Rush replay clears the sprint while preserving the saved best and play counters',async({page})=>{
 await start(page);
 await page.evaluate(()=>{localStorage.setItem('tapRushBest','250');for(let i=0;i<8;i++)registerTap();finishGame();});
 expect(await page.evaluate(()=>localStorage.getItem('tapRushBest'))).toBe('250');
 await page.locator('dialog.game-result-dialog .result-actions button.green').click();
 await expect(page.locator('#gameStatus')).toHaveText('Running');await expect(page.locator('#hits')).toHaveText('0');
 expect(await page.evaluate(()=>localStorage.getItem('tapRushBest'))).toBe('250');
 expect(await page.evaluate(()=>localStorage.getItem('tapRushGamesPlayed'))).toBe('2');
});
test('Tap Rush keeps the green circle and session controls reachable on short phones',async({page})=>{
 await page.setViewportSize({width:320,height:568});await start(page);
 const board=await page.locator('#board').boundingBox(),target=await page.locator('#target').boundingBox(),pause=await page.locator('#earnlyPauseButton').boundingBox();
 expect(target.width).toBe(68);expect(target.height).toBe(68);
 expect(target.x).toBeGreaterThan(board.x);expect(target.y+target.height).toBeLessThan(board.y+board.height);
 expect(pause.y).toBeGreaterThanOrEqual(board.y+board.height);expect(pause.y+pause.height).toBeLessThanOrEqual(568);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
