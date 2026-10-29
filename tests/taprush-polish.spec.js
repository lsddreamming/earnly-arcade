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
for(const prefix of ['', '/www']){
 test('Tap Rush counts real taps across the whole board '+prefix,async({page,isMobile})=>{
  await start(page,prefix);
  const box=await page.locator('#board').boundingBox();
  const deadline=await page.evaluate(()=>roundEndsAt);
  for(const [i,[x,y]] of [[.05,.05],[.95,.05],[.5,.5],[.05,.95],[.95,.95]].entries()){
   await press(page,box.x+box.width*x,box.y+box.height*y,isMobile);
   await expect(page.locator('#hits')).toHaveText(String(i+1));
  }
  expect(await page.evaluate(()=>roundEndsAt)).toBe(deadline);
  await expect(page.locator('#tapCount')).toHaveText('5');
  await expect(page.locator('#rewardPreview')).toHaveText('3');
  await expect(page.locator('.game-guide-overlay')).toHaveClass(/hidden/);
 });
 test('Tap Rush accepts rapid and multi-finger presses without duplicate clicks '+prefix,async({page})=>{
  await start(page,prefix);
  const state=await page.evaluate(()=>{
   for(let i=0;i<100;i++){
    target.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',pointerId:i%2+1,isPrimary:i%2===0,bubbles:true,cancelable:true}));
    target.dispatchEvent(new PointerEvent('pointerup',{pointerType:'touch',pointerId:i%2+1,bubbles:true}));
    target.dispatchEvent(new MouseEvent('click',{detail:1,bubbles:true}));
   }
   target.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'mouse',button:2,bubbles:true}));
   return {hits,reward:rewardForHits(hits)};
  });
  expect(state).toEqual({hits:100,reward:60});
  await expect(page.locator('#hits')).toHaveText('100');
 });
}
test('Tap Rush keeps the full 20-second clock and ends exactly once',async({page})=>{
 await page.clock.install();await start(page);
 await page.evaluate(()=>{window.earnCalls=0;const earn=Arcade.earn;Arcade.earn=(...args)=>{window.earnCalls++;return earn(...args);};});
 await page.clock.fastForward(19000);
 await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.locator('#target').dispatchEvent('pointerdown',{pointerType:'touch',bubbles:true});
 await expect(page.locator('#hits')).toHaveText('1');
 await page.clock.fastForward(1100);
 await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
 await page.evaluate(()=>{registerTap();finishGame();updateTimer();});
 expect(await page.evaluate(()=>({hits,calls:window.earnCalls}))).toEqual({hits:1,calls:1});
});
test('Tap Rush rejects a press after the exact deadline before the timer tick',async({page})=>{
 await start(page);await page.locator('#target').click();
 await page.evaluate(()=>{roundEndsAt=performance.now()-1;target.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',bubbles:true}));});
 await expect(page.locator('#hits')).toHaveText('1');
 await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
});
test('Tap Rush pause and Quit cancel preserve taps and the remaining clock',async({page})=>{
 await start(page);await page.locator('#target').click();
 await page.locator('#earnlyPauseButton').click();
 const frozen=await page.evaluate(()=>({hits,timeLeft}));
 await page.locator('#target').dispatchEvent('pointerdown',{pointerType:'touch',bubbles:true});
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
test('Tap Rush keeps the full tap surface and session controls reachable on short phones',async({page})=>{
 await page.setViewportSize({width:320,height:568});await start(page);
 const board=await page.locator('#board').boundingBox(),target=await page.locator('#target').boundingBox(),pause=await page.locator('#earnlyPauseButton').boundingBox();
 expect(target.width).toBeGreaterThan(board.width-8);expect(target.height).toBeGreaterThan(board.height-8);
 expect(pause.y).toBeGreaterThanOrEqual(board.y+board.height);expect(pause.y+pause.height).toBeLessThanOrEqual(568);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
