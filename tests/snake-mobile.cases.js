const { test, expect } = require('@playwright/test');
async function snakeFixture(page) {
  await page.route('**/cloud.js', r => r.fulfill({contentType:'application/javascript',body:''}));
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({contentType:'application/javascript',body:''}));
  await page.addInitScript(() => {
    localStorage.setItem('arcadeOnboardingSeen','1');
    window.EarnlyCloud = { leaderboard:async () => ({entries:[
      {rank:1,username:'LongPlayerName123',avatar:'🚀',score:27},
      {rank:2,username:'McGogh',avatar:'🧠',score:24},
      {rank:3,username:'Elmerglue',avatar:'🎮',score:12}
    ],label:'apples',lowerIsBetter:false}), submitLeaderboardScore:async () => ({ok:true}) };
  });
}
async function press(locator, info) { if(info.project.use.hasTouch) await locator.tap(); else await locator.click(); }
async function geometry(page) {
  return page.evaluate(() => {
    const box = s => { const r=document.querySelector(s).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
    const nav=document.getElementById('arcadeBottomNav');
    const dock=document.getElementById('snakeControlDock');
    return {board:box('#game'),header:box('.snake-header'),leaderboard:box('#earnlyCompactLeaderboard'),stats:box('.snake-stats'),
      dock:getComputedStyle(dock).display==='none'?null:box('#snakeControlDock'),
      navTop:getComputedStyle(nav).display==='none'?innerHeight:nav.getBoundingClientRect().top,
      overflow:document.documentElement.scrollWidth-innerWidth,
      rows:[...document.querySelectorAll('#earnlyCompactLeaderboard .compact-leaderboard-row')].map(x=>x.getBoundingClientRect().y)};
  });
}
for (const size of [{width:320,height:568},{width:390,height:844},{width:440,height:956}]) {
  test(`Snake mobile ${size.width}px: compact entry and real pause quit controls`, async ({page},info) => {
    await page.setViewportSize(size); await snakeFixture(page); await page.goto('/snake.html');
    const start=page.locator('#startButton'), pause=page.locator('#earnlyPauseButton'), quit=page.locator('#snakeQuit');
    await expect(page.locator('#earnlyCompactLeaderboard .compact-leaderboard-row')).toHaveCount(3);
    await expect(start).toBeInViewport();
    for(const selector of ['.game-start-summary','.game-guide-strip','.game-guide-overlay']) await expect(page.locator(selector)).toBeHidden();
    await expect(page.locator('.snake-quick-tip')).toContainText('Swipe anywhere');
    await expect(page.locator('#snakeControlDock')).toBeHidden();
    await expect.poll(async()=> (await geometry(page)).board.bottom).toBeLessThan(size.height-40);
    const ready=await geometry(page); console.log('SNAKE_READY',size.width,JSON.stringify(ready));
    expect(ready.board.y).toBeLessThan(290); expect(ready.board.y).toBeGreaterThan(ready.leaderboard.bottom); expect(ready.stats.height).toBeLessThan(40);
    expect(ready.leaderboard.height).toBeLessThan(110); expect(ready.board.width).toBeGreaterThanOrEqual(150);
    expect(Math.abs(ready.board.width-ready.board.height)).toBeLessThan(2);
    expect(ready.board.bottom).toBeLessThanOrEqual(ready.navTop-40); expect(ready.overflow).toBeLessThanOrEqual(1);
    expect(Math.max(...ready.rows)-Math.min(...ready.rows)).toBeLessThan(3);
    await info.attach('snake-ready-'+size.width,{body:await page.screenshot(),contentType:'image/png'});
    await press(start,info); await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:6000});
    // Freeze autonomous movement only while validating the physical dock. On a
    // wide WebKit viewport the real Snake can otherwise reach a wall while
    // Playwright waits for post-layout stability, making a valid button vanish.
    await page.evaluate(()=>{ clearInterval(game); game=setInterval(()=>{},10000); });
    await expect(page.locator('#snakeControlDock')).toBeVisible();
    await expect(page.locator('#snakeControlDock')).toContainText('Swipe anywhere or tap arrows');
    await expect(page.locator('#snakeControlDock [data-direction]')).toHaveCount(4);
    // Physical taps prove the controller sits above the full-screen swipe layer.
    await press(page.locator('#snakeControlDock [data-direction="UP"]'),info);
    await expect(page.locator('#snakeControlDock [data-direction="UP"]')).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>nextDirection)).toBe('UP');
    // Physical click/tap, never DOM .click(): proves the full-screen controller is not covering Pause.
    await press(pause,info); await expect(page.locator('#gameStatus')).toHaveText('Paused');
    await expect(quit).toHaveText('× Quit'); await expect(quit).toBeInViewport(); await expect(pause).toBeInViewport();
    await expect(page.locator('#arcadeBottomNav')).toBeHidden();
    const live=await geometry(page); console.log('SNAKE_ACTIVE',size.width,JSON.stringify(live));
    expect(live.board.y).toBeLessThan(250); expect(live.board.bottom).toBeLessThanOrEqual(size.height);
    expect(live.leaderboard.height).toBeLessThan(95);
    expect(live.board.width).toBeGreaterThanOrEqual(size.height <= 600 ? 220 : Math.min(size.width-28,300));
    expect(Math.abs(live.board.width-live.board.height)).toBeLessThan(2);
    expect(live.dock).not.toBeNull();
    expect(live.dock.height).toBeGreaterThanOrEqual(100);
    expect(live.dock.y).toBeGreaterThanOrEqual(live.board.bottom);
    expect(live.dock.bottom).toBeLessThanOrEqual(size.height);
    expect(live.board.y).toBeGreaterThanOrEqual(live.leaderboard.bottom);
    const tickerInside = await page.evaluate(() => {
      const frame=document.getElementById('earnlyCompactLeaderboard').getBoundingClientRect();
      const ticker=document.querySelector('#earnlyCompactLeaderboard .compact-leaderboard-ticker');
      const r=ticker.getBoundingClientRect();
      return getComputedStyle(ticker).display!=='none' && r.top>=frame.top && r.bottom<=frame.bottom;
    });
    expect(tickerInside).toBe(true);
    for (const id of ['snakeQuit','earnlyPauseButton']) {
      const control=await page.locator('#'+id).boundingBox(); expect(control.height, id + " must retain a full-size touch target").toBeGreaterThanOrEqual(44);
      expect(control.y).toBeGreaterThanOrEqual(live.dock.bottom); expect(control.y+control.height).toBeLessThanOrEqual(size.height);
    }
    await info.attach('snake-paused-'+size.width,{body:await page.screenshot(),contentType:'image/png'});
    const before=await page.evaluate(()=>{
      snake=[{x:200,y:200}]; direction=nextDirection='RIGHT';
      return {points:Arcade.number('points'),runs:Arcade.number('gameRuns_snake')};
    });
    await press(page.locator('#snakeControlDock [data-direction="UP"]'),info);
    await expect(page.locator('#gameStatus')).toHaveText('Running');
    await press(pause,info); await expect(page.locator('#gameStatus')).toHaveText('Paused');
    await page.keyboard.press('ArrowUp'); await expect(page.locator('#gameStatus')).toHaveText('Running');
    await press(pause,info); await expect(page.locator('#gameStatus')).toHaveText('Paused');
    const boardTap=await page.locator('#game').boundingBox();
    const tapX=boardTap.x+boardTap.width/2, tapY=boardTap.y+boardTap.height/2;
    if(info.project.use.hasTouch) await page.touchscreen.tap(tapX,tapY);
    else await page.mouse.click(tapX,tapY);
    await expect(page.locator('#gameStatus')).toHaveText('Running');
    await press(quit,info); await expect(page).toHaveURL(/games\.html/);
    await page.waitForFunction(()=>typeof Arcade !== 'undefined');
    expect(await page.evaluate(()=>({points:Arcade.number('points'),runs:Arcade.number('gameRuns_snake')}))).toEqual(before);
  });
}
test('Snake mobile: transparent steering layer never blocks a physical board tap',async({page},info)=>{
  await page.setViewportSize({width:390,height:844}); await snakeFixture(page); await page.goto('/snake.html');
  await press(page.locator('#startButton'),info); await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:6000});
  await page.evaluate(()=>{ clearInterval(game); game=setInterval(()=>{},10000); });
  await expect(page.locator('#snakeControlLayer')).toHaveCSS('pointer-events','none');
  await press(page.locator('#earnlyPauseButton'),info); await expect(page.locator('#gameStatus')).toHaveText('Paused');
  // This must be a real physical tap/click on the canvas, not DOM dispatch.
  await press(page.locator('#game'),info);
  await expect(page.locator('#gameStatus')).toHaveText('Running');
});

test('Snake mobile: quit remains usable while paused',async({page},info)=>{
  await page.setViewportSize({width:390,height:844}); await snakeFixture(page); await page.goto('/snake.html');
  await press(page.locator('#startButton'),info); await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:6000});
  // Hold autonomous movement while Playwright waits for the physical Pause
  // target to settle; otherwise Snake can reach a wall and hide Pause first.
  await page.evaluate(()=>{ clearInterval(game); game=setInterval(()=>{},10000); });
  await press(page.locator('#earnlyPauseButton'),info); await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await press(page.locator('#snakeQuit'),info); await expect(page).toHaveURL(/games\.html/);
  await expect(page.locator('body')).not.toHaveClass(/earnly-gameplay-locked|snake-game-active|earnly-game-paused/);
});
test('Snake mobile: quit cancels a pending countdown without a ghost run',async({page},info)=>{
  await page.setViewportSize({width:390,height:844}); await snakeFixture(page); await page.goto('/snake.html');
  await page.evaluate(()=>{Arcade.countdown=callback=>{window.pendingSnakeStart=callback;};});
  await press(page.locator('#startButton'),info); await expect(page.locator('#gameStatus')).toHaveText('Get Ready');
  // Hold navigation in this test so the cancelled callback can be delivered on the old document.
  await page.evaluate(()=>document.getElementById('snakeQuit').addEventListener('click',e=>e.preventDefault()));
  await press(page.locator('#snakeQuit'),info); await page.evaluate(()=>window.pendingSnakeStart());
  await expect(page.locator('#gameStatus')).toHaveText('Ready');
  expect(await page.evaluate(()=>({game,starting,hidden:controlLayer.hidden}))).toEqual({game:null,starting:false,hidden:true});
  await expect(page.locator('#earnlyPauseButton')).toBeHidden();
});
test('Snake mobile: bottom steering results and replay still work',async({page},info)=>{
  await page.setViewportSize({width:390,height:844}); await snakeFixture(page); await page.goto('/snake.html');
  await press(page.locator('#startButton'),info); await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:6000});
  const steering=await page.evaluate(()=>{
    controlLayer.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:8,pointerType:'touch',isPrimary:true,clientX:170,clientY:innerHeight-30}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:8,pointerType:'touch',isPrimary:true,clientX:170,clientY:innerHeight-110}));
    document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:8,pointerType:'touch',isPrimary:true,clientX:170,clientY:innerHeight-110}));
    const selected=nextDirection; gameOver(); return selected;
  });
  expect(steering).toBe('UP'); await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
  await expect(page.locator('dialog.game-result-dialog .result-best')).toContainText('Best on this device:');
  await expect(page.locator('body')).not.toHaveClass(/snake-game-active/);
  await press(page.locator('dialog.game-result-dialog button').filter({hasText:/Play Again/}).first(),info);
  await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:6000});
  // Keep the replay alive while checking Pause; its movement can otherwise
  // reach a wall before a physical WebKit tap settles.
  await page.evaluate(()=>{ clearInterval(game); game=setInterval(()=>{},10000); });
  await press(page.locator('#earnlyPauseButton'),info); await expect(page.locator('#gameStatus')).toHaveText('Paused');
});
test('Snake mobile: web native assets and cache stay aligned',async({request})=>{
  for(const file of ['snake.html','snake-ui.css']){
    const web=await request.get('/'+file), native=await request.get('/www/'+file);
    expect(web.ok()).toBeTruthy(); expect(native.ok()).toBeTruthy(); expect(await web.text()).toBe(await native.text());
  }
  const worker=await(await request.get('/service-worker.js')).text(); expect(worker).toContain("'./snake-ui.css'");
});

test('Snake mobile: physical Quit stays usable during the countdown overlay',async({page},info)=>{
  await page.setViewportSize({width:390,height:844}); await snakeFixture(page); await page.goto('/snake.html');
  await press(page.locator('#startButton'),info);
  await expect(page.locator('#gameStatus')).toHaveText('Get Ready');
  await expect(page.locator('#snakeQuit')).toHaveText('× Quit');
  await press(page.locator('#snakeQuit'),info);
  await expect(page).toHaveURL(/games\.html/);
  await expect(page.locator('body')).not.toHaveClass(/earnly-gameplay-locked|snake-game-active/);
});


test('Snake: moving into a vacating tail cell is legal, but a growing tail stays solid', async ({page},info) => {
  await page.setViewportSize({width:390,height:844});
  await snakeFixture(page);
  await page.goto('/snake.html');
  await press(page.locator('#startButton'),info);
  await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:6000});

  const legal = await page.evaluate(() => {
    clearInterval(game);
    game = setInterval(()=>{},10000);
    snake = [
      {x:40,y:40},
      {x:40,y:60},
      {x:60,y:60},
      {x:60,y:40}
    ];
    direction = nextDirection = 'RIGHT';
    food = {x:200,y:200};
    draw();
    return {gameAlive:game!==null,head:snake[0],length:snake.length};
  });
  expect(legal.gameAlive).toBe(true);
  expect(legal.head).toEqual({x:60,y:40});
  expect(legal.length).toBe(4);

  const growingCollision = await page.evaluate(() => {
    clearInterval(game);
    game = setInterval(()=>{},10000);
    snake = [
      {x:40,y:40},
      {x:40,y:60},
      {x:60,y:60},
      {x:60,y:40}
    ];
    direction = nextDirection = 'RIGHT';
    food = {x:60,y:40};
    draw();
    return game;
  });
  expect(growingCollision).toBeNull();
  await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
  await expect(page.locator('dialog.game-result-dialog')).toContainText('Hit your tail');
});

test('Snake: apple pickup flashes immediately and wall deaths explain what happened', async ({page},info) => {
  await page.setViewportSize({width:390,height:844});
  await snakeFixture(page);
  await page.goto('/snake.html');
  await press(page.locator('#startButton'),info);
  await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:6000});

  const pickup = await page.evaluate(() => {
    clearInterval(game);
    game = setInterval(()=>{},10000);
    snake = [{x:40,y:40}];
    direction = nextDirection = 'RIGHT';
    food = {x:60,y:40};
    score = 0;
    draw();
    return {score,head:snake[0],flashing:canvas.classList.contains('snake-apple-collected')};
  });
  expect(pickup.score).toBe(1);
  expect(pickup.head).toEqual({x:60,y:40});
  expect(pickup.flashing).toBe(true);

  await page.evaluate(() => {
    clearInterval(game);
    game = setInterval(()=>{},10000);
    snake = [{x:380,y:200}];
    direction = nextDirection = 'RIGHT';
    food = {x:100,y:100};
    draw();
  });
  await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
  await expect(page.locator('dialog.game-result-dialog')).toContainText('Hit the wall');
});

test('Snake: wall apples are occasional and the run ramps to its former pace', async ({page}) => {
  await snakeFixture(page);
  await page.goto('/snake.html');
  const result = await page.evaluate(() => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      snake = [{x:200,y:200}];
      score = 0; lastWallAppleScore = -5;
      const first = randomFood();
      score = 3;
      const wall = randomFood();
      score = 4;
      const next = randomFood();
      score = 8;
      const laterWall = randomFood();
      return {first,wall,next,laterWall,speeds:[0,15,30].map(apples => {score=apples; return snakeTickMs();})};
    } finally { Math.random = originalRandom; }
  });
  expect(result).toEqual({first:{x:20,y:20},wall:{x:0,y:0},next:{x:20,y:20},laterWall:{x:0,y:0},speeds:[180,150,120]});
});


async function unlimitedAccountFixture(page, enabled) {
  await page.route('**/cloud.js', r => r.fulfill({contentType:'application/javascript',body:''}));
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({contentType:'application/javascript',body:''}));
  await page.addInitScript(({enabled}) => {
    const now = new Date();
    const day = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    localStorage.setItem('arcadeOnboardingSeen','1');
    localStorage.setItem('arcadeUsername','DREAMER');
    localStorage.setItem('arcadeProfileName','DREAMER');
    localStorage.setItem('arcadePlayDay', day);
    for (const key of ['snake','blockDrop','tapRush','memory','dodger','brickBreaker','jungleHopper','towerStack','coinCatch','colorMatch','paddleRally','laneRunner','safeCracker','blockGrid','mergeRush','perfectDrop','spiralDrop','shapeFit','bounceRun','trafficEscape','starDefender','neonMaze']) {
      localStorage.setItem(key + 'GamesPlayed','99');
      localStorage.setItem(key + 'BonusPlays','0');
      localStorage.setItem(key + 'PlayAdUnlocks','99');
    }
    const state = {loaded:true,isTester:enabled,unlimitedPlays:enabled,snakeUnlimited:enabled};
    if (enabled) sessionStorage.setItem('earnlyUnlimitedPlays','1');
    else sessionStorage.removeItem('earnlyUnlimitedPlays');
    window.__leaderboardSubmissions = [];
    window.EarnlyCloud = {
      testerAccess:() => ({...state}),
      refreshTesterAccess:async() => ({...state}),
      leaderboard:async () => ({entries:[],label:'apples',lowerIsBetter:false}),
      submitLeaderboardScore:async (game, score) => {
        window.__leaderboardSubmissions.push({game,score});
        return {ok:true,saved:true,rank:7};
      }
    };
  }, {enabled});
}

test('Unlimited account keeps plays available across every game without a tester button', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await unlimitedAccountFixture(page, true);
  await page.goto('/games.html');

  const result = await page.evaluate(() => {
    const keys = Object.keys(Arcade.names);
    const before = Object.fromEntries(keys.map(key => [key, Arcade.remaining(key)]));
    const countersBefore = Object.fromEntries(keys.map(key => [key, Arcade.number(key + 'GamesPlayed')]));
    const consumed = Object.fromEntries(keys.map(key => [key, Arcade.consume(key)]));
    const after = Object.fromEntries(keys.map(key => [key, Arcade.remaining(key)]));
    const countersAfter = Object.fromEntries(keys.map(key => [key, Arcade.number(key + 'GamesPlayed')]));
    return {keys,before,after,consumed,countersBefore,countersAfter,unlimited:Arcade.hasUnlimitedPlays()};
  });

  expect(result.unlimited).toBe(true);
  for (const key of result.keys) {
    expect(result.before[key]).toBe(3);
    expect(result.after[key]).toBe(3);
    expect(result.consumed[key]).toBe(true);
    expect(result.countersAfter[key]).toBe(result.countersBefore[key]);
  }

  await expect(page.locator('body')).not.toContainText('Private Test Run');
  await expect(page.locator('body')).not.toContainText('Private tester access');
  const snake = page.locator('[data-game="snake"]');
  await expect(snake.locator('.game-play-button')).toContainText('Play');
  await expect(snake.locator('.game-play-button')).toHaveAttribute('href','snake.html');
});

test('Normal account still runs out of plays normally', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await unlimitedAccountFixture(page, false);
  await page.goto('/games.html');
  const snake = page.locator('[data-game="snake"]');
  await expect(snake).toContainText('0 plays left');
  await expect(snake.locator('.game-play-button')).toHaveText('Come Back Tomorrow');
  expect(await page.evaluate(() => Arcade.hasUnlimitedPlays())).toBe(false);
});

test('Unlimited account Snake run is a normal leaderboard-eligible run', async ({page},info) => {
  await page.setViewportSize({width:390,height:844});
  await unlimitedAccountFixture(page, true);
  await page.goto('/snake.html');

  const before = await page.evaluate(() => ({
    points:Arcade.number('points'),
    best:Arcade.best('snake').value,
    runs:Arcade.number('gameRuns_snake'),
    plays:Arcade.remaining('snake'),
    played:Arcade.number('snakeGamesPlayed')
  }));

  await press(page.locator('#startButton'),info);
  await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:6000});
  expect(await page.evaluate(()=>snakeTestRun)).toBe(false);

  await page.evaluate(() => {
    clearInterval(game);
    game=setInterval(()=>{},10000);
    score=9;
    gameOver('🧪 Forced unlimited-account finish');
  });

  await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
  await expect(page.locator('dialog.game-result-dialog')).not.toContainText('Private test run');
  await expect.poll(async () => page.evaluate(() => window.__leaderboardSubmissions.some(item => item.game === 'snake' && item.score >= 9))).toBe(true);

  const after = await page.evaluate(() => ({
    points:Arcade.number('points'),
    best:Arcade.best('snake').value,
    runs:Arcade.number('gameRuns_snake'),
    plays:Arcade.remaining('snake'),
    played:Arcade.number('snakeGamesPlayed')
  }));
  expect(after.plays).toBe(3);
  expect(after.played).toBe(before.played);
  expect(after.runs).toBe(before.runs + 1);
  expect(after.best).toBeGreaterThanOrEqual(9);
  expect(after.points).toBeGreaterThanOrEqual(before.points);
});
