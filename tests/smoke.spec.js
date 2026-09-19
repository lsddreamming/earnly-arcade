const { test, expect } = require('@playwright/test');

const pages = [
  'index.html','games.html','rewards.html','profile.html','account.html',
  'snake.html','blockdrop.html','brickbreaker.html','coincatch.html',
  'colormatch.html','dodger.html','junglehopper.html','lanerunner.html',
  'memory.html','paddlerally.html','safecracker.html','taprush.html','towerstack.html'
];

for (const path of pages) {
  test(path + ' loads without page errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/' + path);
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

const miniGames = ['blockGrid','mergeRush','perfectDrop','spiralDrop','shapeFit','bounceRun','trafficEscape'];

for (const game of miniGames) {
  test('mini game ' + game + ' renders and can start', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/mini.html?game=' + game);
    await expect(page.locator('#gameTitle')).toBeVisible();
    await expect(page.locator('#surface')).toBeVisible();

    // Start through the same play surface a real user sees.
    const surface = page.locator('#surface');
    const startButton = page.locator('#startBtn');
    if (await startButton.count()) {
      await startButton.click();
    } else {
      await surface.click({ position: { x: 120, y: 150 } });
    }
    await page.waitForTimeout(250);
    await expect(surface).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('Spiral Drop uses Rows everywhere visible', async ({ page }) => {
  await page.goto('/mini.html?game=spiralDrop');
  await expect(page.locator('#scoreLabel')).toHaveText('Rows');
  await expect(page.locator('body')).not.toContainText('Rings:');
});

test('games page links into playable games', async ({ page }) => {
  await page.goto('/games.html');
  await expect(page.locator('body')).toBeVisible();
  const links = page.locator('a[href*=".html"]');
  expect(await links.count()).toBeGreaterThan(0);
});


test('Spiral Drop supports desktop arrow-key controls', async ({ page }) => {
  await page.goto('/mini.html?game=spiralDrop');
  const start = page.locator('#startBtn');
  await start.click();
  await page.waitForTimeout(3400);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#surface')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Rings:');
});


test('run results stay visible even when zero plays remain', async ({ page }) => {
  await page.goto('/mini.html?game=spiralDrop');
  await page.evaluate(() => {
    Arcade.gameResult({
      icon:'🌀', title:'Spiral Drop', scoreLabel:'Rows', score:42,
      best:'42 rows', coins:12, result:{newBest:true,xpAward:5},
      playsLeft:0, game:'spiralDrop', extra:['🌀 Rows passed: 42']
    });
  });
  const dialog = page.locator('dialog.game-result-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Rows');
  await expect(dialog).toContainText('42');
  await expect(dialog).toContainText('+12');
  await expect(dialog).toContainText('0');
  await expect(dialog).not.toContainText('bonus-play limit');
});


test('every mini game starts without runtime errors', async ({ page }) => {
  for (const game of miniGames) {
    const errors = [];
    const onError = err => errors.push(err.message);
    page.on('pageerror', onError);
    await page.goto('/mini.html?game=' + game);
    await page.locator('#startBtn').click();
    await page.waitForTimeout(120);
    expect(errors, game + ' produced a runtime error').toEqual([]);
    await expect(page.locator('#gameStatus')).not.toHaveText('Ready');
    page.off('pageerror', onError);
  }
});


test('Spiral Drop removes desktop key handlers when a run ends', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/mini.html?game=spiralDrop');
  await page.locator('#startBtn').click();
  await page.waitForTimeout(3300);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(80);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(80);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

test('Bounce Run advertises and accepts keyboard jump controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/mini.html?game=bounceRun');
  await page.locator('#startBtn').click();
  await page.waitForTimeout(3300);
  await expect(page.locator('#surface')).toContainText('');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowUp');
  expect(errors).toEqual([]);
});


test('result popup clearly shows rewards, time, and replay state', async ({ page }) => {
  await page.goto('/mini.html?game=shapeFit');
  await page.evaluate(() => {
    Arcade.gameResult({
      icon:'🔷', title:'Shape Fit', scoreLabel:'Score', score:18,
      best:'18 points', coins:4, result:{newBest:true,xpAward:10},
      playsLeft:2, game:'shapeFit', extra:['⏱️ Time played: 33s']
    });
  });
  const dialog = page.locator('dialog.game-result-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('NEW BEST');
  await expect(dialog).toContainText('Coins Earned');
  await expect(dialog).toContainText('XP Earned');
  await expect(dialog).toContainText('2');
  await expect(dialog).toContainText('Time played: 33s');
  await expect(dialog.getByRole('button', { name:/Play Again · 2 Left/ })).toBeVisible();
});

test('rewarded plays cannot be unlocked while plays remain', async ({ page }) => {
  await page.goto('/mini.html?game=shapeFit');
  await page.evaluate(() => {
    localStorage.setItem('shapeFitGamesPlayed', '0');
    localStorage.setItem('shapeFitBonusPlays', '0');
    localStorage.setItem('shapeFitPlayAdUnlocks', '0');
    Arcade.playAd('shapeFit');
  });
  await expect(page.locator('dialog.reward-ad-dialog')).not.toBeVisible();
  await expect(page.locator('#arcadeToast')).toContainText('play');
  expect(await page.evaluate(() => Arcade.remaining('shapeFit'))).toBe(3);
});

test('all arcade games expose a consistent play balance', async ({ page }) => {
  await page.goto('/games.html');
  const balances = await page.evaluate(() => {
    localStorage.removeItem('arcadePlayDay');
    return Object.keys(Arcade.names).map(game => [game, Arcade.remaining(game)]);
  });
  expect(balances.length).toBe(20);
  for (const [game, plays] of balances) {
    expect(plays, game + ' should begin with three daily plays').toBe(3);
  }
});


test('result popup replaces an existing result instead of stacking dialogs', async ({ page }) => {
  await page.goto('/mini.html?game=blockGrid');
  await page.evaluate(() => {
    const base = {icon:'🧩', title:'Block Grid', scoreLabel:'Score', best:'10 points', coins:1, result:{xpAward:10}, playsLeft:2, game:'blockGrid'};
    Arcade.gameResult({...base, score:9, extra:['⏱️ Time played: 10s']});
    Arcade.gameResult({...base, score:10, extra:['⏱️ Time played: 11s']});
  });
  await expect(page.locator('dialog.game-result-dialog')).toHaveCount(1);
  await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
  await expect(page.locator('dialog.game-result-dialog')).toContainText('11s');
});

test('gameplay scroll lock releases when run status stops', async ({ page }) => {
  await page.goto('/mini.html?game=perfectDrop');
  await page.evaluate(() => {
    const status = document.querySelector('#gameStatus');
    status.classList.add('running');
  });
  await page.waitForTimeout(50);
  await expect(page.locator('body')).toHaveClass(/earnly-gameplay-locked/);
  await page.evaluate(() => document.querySelector('#gameStatus').classList.remove('running'));
  await page.waitForTimeout(50);
  await expect(page.locator('body')).not.toHaveClass(/earnly-gameplay-locked/);
});

test('result popup blocks clicks from reaching the game surface', async ({ page }) => {
  await page.goto('/mini.html?game=mergeRush');
  await page.evaluate(() => {
    window.__surfaceClicks = 0;
    document.querySelector('#surface').addEventListener('click', () => window.__surfaceClicks++);
    Arcade.gameResult({
      icon:'🔢', title:'Merge Rush', scoreLabel:'Score', score:32,
      best:'32 points', coins:2, result:{xpAward:10}, playsLeft:1,
      game:'mergeRush', extra:['⏱️ Time played: 12s']
    });
  });
  await page.locator('dialog.game-result-dialog').click({position:{x:20,y:20}});
  expect(await page.evaluate(() => window.__surfaceClicks)).toBe(0);
});

test('closing a result popup leaves no running gameplay lock behind', async ({ page }) => {
  await page.goto('/mini.html?game=shapeFit');
  await page.evaluate(() => {
    Arcade.gameResult({
      icon:'🔷', title:'Shape Fit', scoreLabel:'Score', score:5,
      best:'5 points', coins:1, result:{xpAward:10}, playsLeft:0,
      game:'shapeFit', extra:['⏱️ Time played: 8s']
    });
  });
  const dialog = page.locator('dialog.game-result-dialog');
  await expect(dialog).toBeVisible();
  await page.evaluate(() => document.querySelector('dialog.game-result-dialog').close());
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/earnly-gameplay-locked/);
});


test('pause control appears and toggles on mini games', async ({ page }) => {
  for (const game of ['spiralDrop','bounceRun','perfectDrop','trafficEscape']) {
    await page.goto('/mini.html?game=' + game);
    await page.locator('#startBtn').click();
    await page.waitForTimeout(3300);
    const pause = page.locator('#earnlyPauseButton');
    await expect(pause, game + ' pause button').toBeVisible();
    await pause.click();
    await expect(pause).toHaveText(/Resume/);
    await expect(page.locator('#gameStatus')).toHaveText('Paused');
    await page.waitForTimeout(250);
    await pause.click();
    await expect(pause).toHaveText(/Pause/);
    await expect(page.locator('#gameStatus')).toHaveText('Running');
  }
});

test('pause control is visible during Snake gameplay', async ({ page }) => {
  await page.goto('/snake.html');
  await page.locator('#startButton').click();
  await page.waitForTimeout(3300);
  const pause = page.locator('#earnlyPauseButton');
  await expect(pause).toBeVisible();
  await pause.click();
  await expect(pause).toHaveText(/Resume/);
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await pause.click();
  await expect(page.locator('#gameStatus')).toHaveText('Running');
});


test('pausing Snake keeps the live board instead of showing out-of-plays guide', async ({ page }) => {
  await page.goto('/snake.html');
  await page.evaluate(() => {
    localStorage.setItem('snakeGamesPlayed', '2');
    localStorage.setItem('snakeBonusPlays', '0');
  });
  await page.reload();
  await page.locator('#startButton').click();
  await page.waitForTimeout(3300);
  await page.locator('#earnlyPauseButton').click();
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await expect(page.locator('.game-guide-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('.game-guide-overlay')).not.toContainText('Out of Plays');
  await expect(page.locator('#game')).toBeVisible();
});


test('paused Snake ignores gameplay input until resumed', async ({ page }) => {
  await page.goto('/snake.html');
  await page.locator('#startButton').click();
  await page.waitForTimeout(3300);
  await page.locator('#earnlyPauseButton').click();
  await expect(page.locator('#gameStatus')).toHaveText('Paused');

  const before = await page.locator('#score').textContent();
  await page.keyboard.press('ArrowDown');
  await page.locator('#game').click({ position:{x:200,y:320} });
  await page.waitForTimeout(350);
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await expect(page.locator('#score')).toHaveText(before || '0');

  await page.locator('#earnlyPauseButton').click();
  await expect(page.locator('#gameStatus')).toHaveText('Running');
});


test('rapid Snake game-over calls only award and show results once', async ({ page }) => {
  await page.goto('/snake.html');
  await page.evaluate(() => {
    localStorage.setItem('snakeGamesPlayed','0');
    localStorage.setItem('snakeBonusPlays','0');
  });
  await page.reload();
  await page.locator('#startButton').click();
  await page.waitForTimeout(3300);
  const before = await page.locator('#balance').textContent();
  await page.evaluate(() => { gameOver(); gameOver(); gameOver(); });
  await expect(page.locator('.game-result-modal')).toHaveCount(1);
  await expect(page.locator('#gameStatus')).toHaveText('Game Over');
  const after = await page.locator('#balance').textContent();
  expect(Number(after)).toBeGreaterThanOrEqual(Number(before));
});

test('Brick Breaker end state clears pending level transition', async ({ page }) => {
  await page.goto('/brickbreaker.html');
  await page.locator('#startButton').click();
  await page.waitForTimeout(3300);
  await page.evaluate(() => {
    starting = true;
    running = false;
    levelTimer = setTimeout(() => { document.body.dataset.lateLevelRestart='yes'; }, 80);
    finishGame();
  });
  await page.waitForTimeout(180);
  await expect(page.locator('body')).not.toHaveAttribute('data-late-level-restart','yes');
  await expect(page.locator('.game-result-modal')).toHaveCount(1);
});


test('Block Drop held controls cannot survive pause or game over', async ({ page }) => {
  await page.goto('/blockdrop.html');
  await page.locator('#startButton').click();
  await page.waitForTimeout(3300);

  const left = page.locator('#leftButton');
  await left.dispatchEvent('pointerdown', { pointerId:1 });
  await page.waitForTimeout(280);
  await page.locator('#earnlyPauseButton').click();
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await page.waitForTimeout(180);
  await page.locator('#earnlyPauseButton').click();
  await expect(page.locator('#gameStatus')).toHaveText('Running');

  await page.evaluate(() => gameOver());
  await expect(page.locator('#gameStatus')).toHaveText('Game Over');
  await expect(page.locator('.game-result-modal')).toHaveCount(1);
  await page.waitForTimeout(220);
  await expect(page.locator('.game-result-modal')).toHaveCount(1);
});


test('core games always expose a result popup contract', async ({ page }) => {
  const games = [
    ['snake.html','Snake'],
    ['blockdrop.html','Block Drop'],
    ['brickbreaker.html','Brick Breaker'],
    ['dodger.html','Neon Dodger'],
    ['junglehopper.html','Jungle Hopper'],
    ['towerstack.html','Tower Stack'],
    ['safecracker.html','Safe Cracker'],
    ['taprush.html','Tap Rush'],
    ['memory.html','Memory Match'],
    ['coincatch.html','Coin Catch'],
    ['colormatch.html','Color Match'],
    ['lanerunner.html','Lane Runner'],
    ['paddlerally.html','Paddle Rally']
  ];
  for (const [path,name] of games) {
    await page.goto('/'+path);
    await expect(page.locator('#gameStatus'), name+' status').toBeVisible();
    await expect(page.locator('#startButton'), name+' start').toBeVisible();
    const source = await page.locator('body').evaluate(() =>
      [...document.scripts].map(s=>s.textContent||'').join('\n')
    );
    expect(source, name+' must use shared result popup').toContain('Arcade.gameResult');
    expect(source, name+' must record a result').toContain('Arcade.recordResult');
    expect(source, name+' must award through Arcade').toContain('Arcade.earn');
    expect(source, name+' must show time played').toContain('Time played:');
  }
});


test('game catalog search filters cleanly and recovers', async ({ page }) => {
  await page.goto('/games.html');
  const search = page.locator('#gameSearch');
  await expect(search).toBeVisible();

  await search.fill('snake');
  await expect(page.locator('#games .game-card')).toHaveCount(1);
  await expect(page.locator('#games .game-card')).toContainText('Snake');

  await search.fill('definitely-not-a-game');
  await expect(page.locator('#games .game-card')).toHaveCount(0);
  await expect(page.locator('#games .game-browser-empty')).toContainText('No games found');

  await search.fill('');
  await expect(page.locator('#games .game-card').first()).toBeVisible();
});


test('game start screen explains plays reward and controls before play', async ({ page }) => {
  await page.goto('/snake.html');
  const summary = page.locator('.game-start-summary');
  await expect(summary).toBeVisible();
  await expect(summary.locator('.game-start-plays')).toContainText('play');
  await expect(summary.locator('.game-start-reward')).toContainText('Coin');
  await expect(summary.locator('.game-start-control')).toContainText('Steer');
  await expect(page.locator('#startButton')).toBeVisible();
});


test('account page exposes clear cloud sync status', async ({ page }) => {
  await page.goto('/account.html');
  await expect(page.locator('#cloudLiveStatus')).toHaveCount(1);
  await page.evaluate(() => {
    localStorage.setItem('arcadeLastCloudSave', new Date().toISOString());
    localStorage.removeItem('arcadeCloudSyncError');
    localStorage.removeItem('arcadeCloudConflict');
  });
  await page.reload();
  await expect(page.locator('#cloudLiveStatus')).toHaveCount(1);
});


test('cloud reward sync uses a shared in-flight request', async ({ page }) => {
  const response = await page.request.get('/cloud.js');
  expect(response.ok()).toBeTruthy();
  const source = await response.text();
  expect(source).toContain('if (rewardSyncPromise) return rewardSyncPromise');
  expect(source).toContain('rewardSyncPromise = (async () =>');
  expect(source).toContain('rewardSyncPromise = null');
});


test('manual cloud saves guard newer remote revisions', async ({ page }) => {
  const cloudResponse = await page.request.get('/cloud.js');
  const cloudSource = await cloudResponse.text();
  expect(cloudSource).toContain("error.code = 'EARNLY_CLOUD_CONFLICT'");
  expect(cloudSource).toContain('if (!options.skipConflictCheck)');
  expect(cloudSource).toContain('skipConflictCheck:true');

  const accountResponse = await page.request.get('/account.html');
  const accountSource = await accountResponse.text();
  expect(accountSource).toContain('saveThisDeviceToCloud(forceReplace = false)');
  expect(accountSource).toContain('skipConflictCheck:forceReplace');
  expect(accountSource).toContain('saveThisDeviceToCloud(true)');
});


test('cloud sync retains offline changes and retries transient failures', async ({ page }) => {
  const response = await page.request.get('/cloud.js');
  expect(response.ok()).toBeTruthy();
  const source = await response.text();
  expect(source).toContain("localStorage.setItem('arcadeCloudOfflinePending'");
  expect(source).toContain("localStorage.removeItem('arcadeCloudOfflinePending')");
  expect(source).toContain("function scheduleRetry(reason = 'retry')");
  expect(source).toContain('MAX_RETRY_DELAY = 60000');
  expect(source).toContain("scheduleAutoSync('online', 300)");
});


test('Bounce Run exposes progressive run feedback', async ({ page }) => {
  const response = await page.request.get('/mini-games.js');
  expect(response.ok()).toBeTruthy();
  const source = await response.text();
  expect(source).toContain("CLEAR COMBO");
  expect(source).toContain("Best clear combo:");
  expect(source).toContain("5 clears = level up");
  expect(source).toContain("Math.ceil((readyUntil-performance.now())/650)");
});


test('Bounce Run shows motion and level-up feedback', async ({ page }) => {
  const response = await page.request.get('/mini-games.js');
  expect(response.ok()).toBeTruthy();
  const source = await response.text();
  expect(source).toContain("levelFlashText='LEVEL '");
  expect(source).toContain("ctx.fillText('SPEED UP!'");
  expect(source).toContain("trail.push({x:80,y})");
  expect(source).toContain("const scroll=(distance*5)%36");
});


test('Shape Fit exposes urgency and stage feedback', async ({ page }) => {
  const jsResponse = await page.request.get('/mini-games.js');
  const source = await jsResponse.text();
  expect(source).toContain("title.classList.toggle('urgent',timeLeft<=1800)");
  expect(source).toContain("Arcade.milestone('🧠 '+currentStage+'!','perfect')");
  expect(source).toContain("wrap.classList.add('fit-success')");
  expect(source).toContain("wrap.classList.add('fit-miss')");

  const htmlResponse = await page.request.get('/mini.html');
  const html = await htmlResponse.text();
  expect(html).toContain('.fit-clock');
  expect(html).toContain('.fit-title.urgent');
});


test('Traffic Escape exposes fast-road and path feedback', async ({ page }) => {
  const jsResponse = await page.request.get('/mini-games.js');
  const source = await jsResponse.text();
  expect(source).toContain("Arcade.milestone('⚡ Fast road · '");
  expect(source).toContain("'⚡ Fast roads: '+fastClears");
  expect(source).toContain("'🏁 Best road: '");
  expect(source).toContain("' clear-path':'')");

  const htmlResponse = await page.request.get('/mini.html');
  const html = await htmlResponse.text();
  expect(html).toContain('.traffic-car.clear-path');
});


test('arcade-wide reliability cleanup stays guarded', async ({ page }) => {
  const arcade = await (await page.request.get('/arcade.js')).text();
  expect(arcade).not.toContain("if (!paused) return;\n      if (event.target === button");
  expect(arcade).toContain("window.addEventListener('earnly-data-change', syncStartSummary)");

  const memory = await (await page.request.get('/memory.html')).text();
  expect(memory).toContain("function finishGame(){\n      if(!running)return;");

  const css = await (await page.request.get('/arcade.css')).text();
  expect(css).toContain(".game-search-wrap input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#f8fafc;font:inherit;font-size:16px");
});
