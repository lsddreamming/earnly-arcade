const {test,expect}=require('@playwright/test');
async function tap(locator,page){await expect(locator).toBeVisible();await expect(locator).toBeInViewport();const b=await locator.boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}
const games=['snake','blockdrop','brickbreaker','coincatch','colormatch','dodger','junglehopper','lanerunner','memory','paddlerally','safecracker','taprush','towerstack','neonmaze','stardefender'].map(x=>x+'.html').concat(['blockGrid','mergeRush','perfectDrop','spiralDrop','shapeFit','bounceRun','trafficEscape'].map(x=>'mini.html?game='+x));
for(const width of [320,390,440]) for(const game of games){
 test('iPhone '+width+' '+game+' repeated safe exits',async({page})=>{
  await page.setViewportSize({width,height:width===320?740:width===390?844:956});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');window.EarnlyCloud={leaderboard:async()=>({entries:[],label:'score',lowerIsBetter:false}),submitLeaderboardScore:async()=>({ok:true})};});
  await page.goto('/'+game+(game==='stardefender.html'?'?sd=20260925d':''));
  if(game==='snake.html'){const time=new Date('2026-09-30T12:00:00Z');await page.clock.install({time});await page.clock.pauseAt(time);}
  const gameUrl=page.url();
  const initialCoins=await page.evaluate(()=>Arcade.number('points'));
  const start=page.locator(game==='blockdrop.html'?'#blockDropBoardStart':'#startButton');
  if(await start.isVisible()) await tap(start,page);
  else {const surface=page.locator('#surface,#game,.touch-surface,.game-guide-surface,#board').first();await tap(surface,page);}
  if(game==='snake.html') await page.clock.runFor(2500);
  const pause=page.locator('#earnlyPauseButton,#pauseButton');
  await expect(page.locator('#gameStatus')).toHaveClass(/running/,{timeout:10000});
  await expect(pause).toBeVisible({timeout:10000});
  if(game==='junglehopper.html') await tap(page.locator('#game'),page);
  await tap(pause,page);
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  const primary=page.locator('#snakeQuit,#blockDropExit,#brickQuit,#coinCatchExit,#earnlyQuitButton').filter({visible:true});
  const quit=await primary.count()?primary.first():page.locator('.earnly-game-exit').filter({visible:true}).first();
  await expect(quit).toBeVisible();
  await expect(quit).toBeInViewport();
  const sizes=await page.evaluate(()=>{const p=document.querySelector('#earnlyPauseButton,#pauseButton').getBoundingClientRect();const candidates=[...document.querySelectorAll('#snakeQuit,#blockDropExit,#brickQuit,#coinCatchExit,#earnlyQuitButton'),...document.querySelectorAll('.earnly-game-exit')];const q=candidates.find(x=>x.getBoundingClientRect().width&&getComputedStyle(x).display!=='none').getBoundingClientRect();return{pauseWidth:p.width,pauseHeight:p.height,quitWidth:q.width,quitHeight:q.height};});
  expect(sizes.pauseHeight).toBeGreaterThanOrEqual(44);expect(sizes.quitHeight).toBeGreaterThanOrEqual(44);expect(sizes.pauseWidth).toBeGreaterThan(sizes.quitWidth);
  for(let i=0;i<5;i++){
   await tap(quit,page); const dialog=page.locator('.earnly-quit-dialog');
   await expect(dialog).toBeVisible();await expect(dialog).toContainText('Are you sure you want to quit this game?');
   await expect(page.locator('#gameStatus')).toHaveText('Paused');
   await tap(page.locator('[data-keep]'),page);
   await expect(dialog).toHaveCount(0);await expect(page.locator('#gameStatus')).toHaveText('Paused');
   await expect(page).toHaveURL(gameUrl);
  }
  if(game==='snake.html') {await tap(page.locator('[data-direction="DOWN"]'),page);const before=await page.locator('#game').evaluate(c=>c.toDataURL());await page.clock.runFor(220);expect(await page.locator('#game').evaluate(c=>c.toDataURL())).not.toBe(before);} else await tap(pause,page);
  await expect(page.locator('#gameStatus')).toHaveClass(/running/);
  if(game==='junglehopper.html') await tap(page.locator('#game'),page);
  await tap(quit,page);await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await tap(page.locator('[data-keep]'),page);await expect(page.locator('#gameStatus')).toHaveClass(/running/);
  if(game==='snake.html') await tap(page.locator('[data-direction="LEFT"]'),page);
  if(game==='junglehopper.html') await tap(page.locator('#game'),page);
  if(game==='snake.html') await page.clock.runFor(200);
  if(width!==390) await tap(pause,page);
  await tap(quit,page);
  await tap(page.locator('[data-quit]'),page);
  await expect(page).toHaveURL(/games\.html$/);
  await expect(page.locator('.game-result-dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>Arcade.number('points'))).toBe(initialCoins);
  expect(errors).toEqual([]);
 });
}
