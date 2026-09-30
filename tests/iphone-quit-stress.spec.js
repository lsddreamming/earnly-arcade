const {test,expect}=require('@playwright/test');
const games=['snake','blockdrop','brickbreaker','coincatch','colormatch','dodger','junglehopper','lanerunner','memory','paddlerally','safecracker','taprush','towerstack','neonmaze','stardefender'].map(x=>x+'.html').concat(['blockGrid','mergeRush','perfectDrop','spiralDrop','shapeFit','bounceRun','trafficEscape'].map(x=>'mini.html?game='+x));
for(const width of [320,390,440]) for(const game of games){
 test('iPhone '+width+' '+game+' repeated safe exits',async({page})=>{
  await page.setViewportSize({width,height:width===320?740:width===390?844:956});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');window.EarnlyCloud={leaderboard:async()=>({entries:[],label:'score',lowerIsBetter:false}),submitLeaderboardScore:async()=>({ok:true})};});
  await page.goto('/'+game);
  const initialCoins=await page.evaluate(()=>Arcade.number('points'));
  const start=page.locator(game==='blockdrop.html'?'#blockDropBoardStart':'#startButton');
  if(await start.isVisible()) await start.tap();
  else {const surface=page.locator('#surface,#game,canvas.touch-surface').first();await surface.tap();}
  const pause=page.locator('#earnlyPauseButton,#pauseButton');
  await expect(pause).toBeVisible({timeout:10000});
  await pause.tap();
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  const quit=page.locator('#snakeQuit,#blockDropExit,#brickQuit,#coinCatchExit,#earnlyQuitButton,.earnly-game-exit').filter({visible:true}).first();
  await expect(quit).toBeVisible();
  await expect(quit).toBeInViewport();
  const sizes=await page.evaluate(()=>{const p=document.querySelector('#earnlyPauseButton,#pauseButton').getBoundingClientRect();const q=[...document.querySelectorAll('#snakeQuit,#blockDropExit,#brickQuit,#coinCatchExit,#earnlyQuitButton,.earnly-game-exit')].find(x=>x.getBoundingClientRect().width&&getComputedStyle(x).display!=='none').getBoundingClientRect();return{pauseWidth:p.width,pauseHeight:p.height,quitWidth:q.width,quitHeight:q.height};});
  expect(sizes.pauseHeight).toBeGreaterThanOrEqual(44);expect(sizes.quitHeight).toBeGreaterThanOrEqual(44);expect(sizes.pauseWidth).toBeGreaterThan(sizes.quitWidth);
  for(let i=0;i<5;i++){
   await quit.tap(); const dialog=page.locator('.earnly-quit-dialog');
   await expect(dialog).toBeVisible();await expect(dialog).toContainText('Are you sure you want to quit this game?');
   await expect(page.locator('#gameStatus')).toHaveText('Paused');
   await page.locator('[data-keep]').tap();
   await expect(dialog).toHaveCount(0);await expect(page.locator('#gameStatus')).toHaveText('Paused');
   await expect(page).toHaveURL(new RegExp(game.split('?')[0].replace('.','\\.')));
  }
  await pause.tap();await expect(page.locator('#gameStatus')).toHaveText('Running');
  await quit.tap();await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await page.locator('[data-keep]').tap();await expect(page.locator('#gameStatus')).toHaveText('Running');
  await pause.tap();await quit.tap();
  await page.locator('[data-quit]').tap();
  await expect(page).toHaveURL(/games\.html$/);
  await expect(page.locator('.game-result-dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>Arcade.number('points'))).toBe(initialCoins);
  expect(errors).toEqual([]);
 });
}
