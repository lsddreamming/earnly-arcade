const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
  await page.route('https://**',route=>route.abort());
  await page.goto('/paddlerally.html');
  await page.evaluate(()=>{Arcade.countdown=fn=>fn()});
});
async function start(page){await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');await page.evaluate(()=>cancelAnimationFrame(animation))}
test('touch tracks absolute position once, ignores other fingers and stops after cancellation',async({page})=>{
  await start(page);
  const result=await page.evaluate(()=>{
    const rect=rallyControlZone.getBoundingClientRect();
    const event=(type,fraction,id=71)=>rallyControlZone.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:id===71,bubbles:true,cancelable:true,clientX:rect.left+rect.width*fraction,clientY:rect.top+20}));
    event('pointerdown',.25);const first=paddle.x+paddle.w/2;
    event('pointermove',.75);const moved=paddle.x+paddle.w/2;
    event('pointerdown',.1,72);event('pointermove',.1,72);const other=paddle.x+paddle.w/2;
    event('pointermove',2);const edge=paddle.x+paddle.w;
    event('pointercancel',2);event('pointermove',0);const cancelled=paddle.x+paddle.w;
    return {first,moved,other,edge,cancelled};
  });
  expect(result).toEqual({first:90,moved:270,other:270,edge:360,cancelled:360});
});
test('pause, tab hiding and resume freeze the run without consuming another play',async({page})=>{
  await start(page);const before=await page.evaluate(()=>({x:ball.x,y:ball.y,plays:Arcade.remaining('paddleRally')}));
  await page.locator('#pauseButton').click();
  await page.evaluate(()=>{loop(performance.now()+1000);moveTo(100)});
  expect(await page.evaluate(()=>({x:ball.x,y:ball.y}))).toEqual({x:before.x,y:before.y});
  await page.locator('#pauseButton').click();
  await page.evaluate(()=>{cancelAnimationFrame(animation);window.dispatchEvent(new Event('blur'))});
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  expect(await page.evaluate(()=>Arcade.remaining('paddleRally'))).toBe(before.plays);
});
test('native background and foreground events leave a running rally paused',async({page})=>{
  await start(page);
  const before=await page.evaluate(()=>({x:ball.x,y:ball.y,plays:Arcade.remaining('paddleRally')}));
  for(const event of ['pause','pause','resume']){
    await page.evaluate(type=>{document.dispatchEvent(new Event(type));loop(performance.now()+1000)},event);
    await expect(page.locator('#pauseButton')).toHaveText('Resume');
    expect(await page.evaluate(()=>({x:ball.x,y:ball.y,plays:Arcade.remaining('paddleRally')}))).toEqual(before);
  }
  await page.locator('#pauseButton').click();
  await expect(page.locator('#gameStatus')).toHaveText('Running');
  // A foreground event must still protect the run if background delivery was lost.
  await page.evaluate(()=>document.dispatchEvent(new Event('resume')));
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
});
test('an interruption during countdown waits for an explicit Resume',async({page})=>{
  await page.evaluate(()=>{Arcade.countdown=fn=>{window.completeCountdown=fn}});
  await page.locator('#startButton').click();
  await expect(page.locator('#gameStatus')).toHaveText('Get Ready');
  const plays=await page.evaluate(()=>Arcade.remaining('paddleRally'));
  await page.evaluate(()=>{
    document.dispatchEvent(new Event('pause'));
    document.dispatchEvent(new Event('resume'));
    window.completeCountdown();
  });
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  expect(await page.evaluate(()=>({x:ball.x,y:ball.y,animation,plays:Arcade.remaining('paddleRally')}))).toEqual({x:180,y:370,animation:null,plays});
  await page.locator('#pauseButton').click();
  await expect(page.locator('#gameStatus')).toHaveText('Running');
  expect(await page.evaluate(()=>Arcade.remaining('paddleRally'))).toBe(plays);
});
test('held keyboard input moves smoothly even after the Play button was focused',async({page})=>{
  await start(page);const x=await page.evaluate(()=>paddle.x);
  await page.keyboard.down('ArrowRight');
  const moved=await page.evaluate(()=>{lastFrame=100;loop(150);cancelAnimationFrame(animation);return paddle.x});
  await page.keyboard.up('ArrowRight');
  expect(moved-x).toBeCloseTo(22);
  expect(await page.evaluate(()=>keys.size)).toBe(0);
});
test('returns score once, precision stays cosmetic and finish awards once',async({page})=>{
  await start(page);
  const result=await page.evaluate(()=>{
    ball.x=paddle.x+paddle.w/2;ball.y=paddle.y-ball.r-1;ball.dx=0;ball.dy=700;lastFrame=100;loop(116.67);cancelAnimationFrame(animation);
    const state={score,cleanReturns,centerStreak,coins:rewardFor(score)};centerStreak=99;state.streakCoins=rewardFor(score);
    const awards=[];Arcade.earn=(...args)=>awards.push(args);finish();finish();return {...state,awards:awards.length};
  });
  expect(result).toMatchObject({score:1,cleanReturns:1,centerStreak:1,awards:1});expect(result.coins).toBe(result.streakCoins);
  await expect(page.locator('.game-result-dialog')).toBeVisible();
});
test('sound choice persists and reduced motion removes trails and bursts',async({page})=>{
  await page.locator('#rallySound').click();await expect(page.locator('#rallySound')).toHaveText('Sound off');await page.reload();
  await expect(page.locator('#rallySound')).toHaveText('Sound off');
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
  const effects=await page.evaluate(()=>{running=true;lastFrame=100;burst(100,100,true);loop(116);cancelAnimationFrame(animation);return {sparks:sparks.length,rings:rings.length,trail:trail.length}});
  expect(effects).toEqual({sparks:0,rings:0,trail:0});
});
for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}]){
 test('court and controls fit '+viewport.width+'×'+viewport.height,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize(viewport);await page.reload();
  await expect(page.locator('#startButton')).toBeVisible();
  if(viewport.width<viewport.height){const ready=await page.locator('#startButton').boundingBox();expect(ready.y).toBeLessThan(340);expect(ready.y+ready.height).toBeLessThan(viewport.height-60)}
  await page.screenshot({path:info.outputPath('paddle-ready-'+viewport.width+'.png'),fullPage:true});
  await page.evaluate(()=>{Arcade.countdown=fn=>fn()});await start(page);
  await page.evaluate(()=>{ball.x=paddle.x+paddle.w/2;ball.y=paddle.y-ball.r-1;ball.dx=0;ball.dy=400;lastFrame=100;loop(116.67);cancelAnimationFrame(animation);draw()});
  for(const id of ['game','rallyControlZone','rallyActions','pauseButton','earnlyQuitButton','rallySound']){const b=await page.locator('#'+id).boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(viewport.width+1);expect(b.y+b.height).toBeLessThanOrEqual(viewport.height+1);expect(b.width).toBeGreaterThanOrEqual(44)}
  const board=await page.locator('#game').boundingBox(),controls=await page.locator('#rallyControlZone').boundingBox();
  if(viewport.width<viewport.height){expect(board.y+board.height).toBeLessThanOrEqual(controls.y);const pause=await page.locator('#pauseButton').boundingBox();expect(pause.y).toBeGreaterThanOrEqual(controls.y+controls.height);expect(pause.height).toBeGreaterThanOrEqual(44)}
  await page.screenshot({path:info.outputPath('paddle-active-'+viewport.width+'.png'),fullPage:true});
  expect(errors).toEqual([]);
 });
}
