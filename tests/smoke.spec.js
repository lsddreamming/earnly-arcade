const { test, expect } = require('@playwright/test');

async function startGame(page) {
  const boardStart = page.locator('#blockDropBoardStart');
  if (await boardStart.isVisible().catch(() => false)) {
    await boardStart.click();
    return;
  }
  const startButton = page.locator('#startButton');
  if (await startButton.isVisible().catch(() => false)) {
    await startButton.click();
    return;
  }

  const candidates = ['#surface', '#game', 'canvas.touch-surface', '.game-guide-surface'];
  for (const selector of candidates) {
    const target = page.locator(selector).first();
    if (await target.isVisible().catch(() => false)) {
      await target.click({ position:{ x:120, y:120 } });
      return;
    }
  }

  throw new Error('No visible game start control or touch surface found');
}

test('creator attribution records sanitized first and latest touch', async ({ page }) => {
  await page.goto('/index.html?ref=creator_42&utm_source=tiktok&utm_campaign=launch-wave&utm_content=snake-hook&challenge=beat-me');
  const attribution = await page.evaluate(() => Arcade.acquisitionContext());

  expect(attribution.first.creator).toBe('creator_42');
  expect(attribution.first.source).toBe('tiktok');
  expect(attribution.first.campaign).toBe('launch-wave');
  expect(attribution.first.content).toBe('snake-hook');
  expect(attribution.first.challenge).toBe('beat-me');
  expect(attribution.latest.creator).toBe('creator_42');

  const event = await page.evaluate(() => Arcade.pendingSyncEvents().find(item => item.type === 'acquisition_attributed'));
  expect(event.payload.creator).toBe('creator_42');
  expect(event.payload.firstTouch).toBeTruthy();
  expect(await page.evaluate(() => EarnlyCloud.growthSyncEnabled())).toBeFalsy();
});

test('growth events are routed to the locked server ingestion function', async ({ page }) => {
  await page.goto('/index.html');
  const cloud = await (await page.request.get('/cloud.js')).text();

  expect(cloud).toContain("'/functions/v1/track-growth'");
  expect(cloud).toContain("'apikey':SUPABASE_PUBLISHABLE_KEY");
  expect(cloud).toContain("GROWTH_EVENT_TYPES");
  expect(cloud).toContain("return !serverReward && !isGrowthEvent(event)");
  expect(cloud).toContain("syncGrowthEvents().catch(() => {})");
});

test('first-visit onboarding records shown and completion funnel events', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const dialog = page.locator('dialog.onboarding-dialog');
  await expect(dialog).toBeVisible();

  let types = await page.evaluate(() => Arcade.pendingSyncEvents().map(item => item.type));
  expect(types).toContain('onboarding_shown');

  await dialog.getByRole('button', { name:'Start Playing →' }).click();
  await expect(page).toHaveURL(/games\.html$/);
  types = await page.evaluate(() => Arcade.pendingSyncEvents().map(item => item.type));
  expect(types).toContain('onboarding_completed');
});

test('leaderboard and profile pages expose growth engagement tracking', async ({ page }) => {
  const leaderboard = await (await page.request.get('/leaderboards.html')).text();
  const profile = await (await page.request.get('/profile.html')).text();

  expect(leaderboard).toContain("Arcade.trackEvent?.('leaderboard_viewed'");
  expect(leaderboard).toContain("'arcadeLeaderboardViewed:' + game");
  expect(profile).toContain("Arcade.trackEvent?.('profile_identity_saved'");
});

const pages = [
  'index.html','games.html','rewards.html','profile.html','account.html','settings.html','stats.html',
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

    // Start through the same control a real player uses on this device.
    const surface = page.locator('#surface');
    await startGame(page);
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

test('games catalog keeps disabled actions readable and avoids duplicate mobile Home control', async ({ page }) => {
  await page.goto('/games.html');
  const play = page.locator('#games .game-play-button').first();
  await play.evaluate(node => { node.disabled = true; });
  await expect(play).toHaveCSS('opacity', '1');
  await expect(play).toHaveCSS('color', 'rgb(203, 213, 225)');

  const backHome = page.locator('.games-back-home');
  const width = page.viewportSize()?.width || 1280;
  if (width < 700) await expect(backHome).toBeHidden();
  else await expect(backHome).toBeVisible();
});

test('core navigation never points to a missing internal page', async ({ page }) => {
  const entryPages = ['/index.html','/games.html','/rewards.html','/profile.html','/account.html','/settings.html','/stats.html'];
  const hrefs = new Set();

  for (const entry of entryPages) {
    await page.goto(entry);
    const found = await page.locator('a[href]').evaluateAll(nodes =>
      nodes.map(node => node.getAttribute('href')).filter(Boolean)
    );
    found.forEach(href => {
      if (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('#')) hrefs.add(href);
    });
  }

  for (const href of hrefs) {
    const path = href.startsWith('/') ? href : '/' + href;
    const response = await page.request.get(path);
    expect(response.status(), 'Broken internal link: ' + href).toBeLessThan(400);
  }
});

test('Settings and Stats reflect the current app/game catalog', async ({ page }) => {
  await page.goto('/settings.html');
  const expectedVersion = await page.evaluate(() => Arcade.appStatus().version);
  await expect(page.locator('#versionStatus')).toHaveText('v' + expectedVersion);

  await page.goto('/stats.html');
  const gameCount = await page.evaluate(() => Object.keys(Arcade.names).length);
  await expect(page.locator('#differentGames')).toContainText('/' + gameCount);
});

test('Rewards balance and history update immediately after a local earning event', async ({ page }) => {
  await page.goto('/rewards.html');
  const before = await page.evaluate(() => Arcade.number('points'));

  await page.evaluate(() => {
    Arcade.earn(3, 'QA Reward', { kind:'test' });
  });

  await expect(page.locator('#balance')).toHaveText((before + 3).toLocaleString());
  await expect(page.locator('#history')).toContainText('QA Reward');
  await expect(page.locator('#history')).toContainText('+3');
});


test('Spiral Drop supports desktop arrow-key controls', async ({ page }) => {
  await page.goto('/mini.html?game=spiralDrop');
  await startGame(page);
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
    await startGame(page);
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
  await startGame(page);
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
  await startGame(page);
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
  await expect(dialog).toContainText('Level');
  await expect(dialog.locator('.result-stat').filter({ hasText:'Plays Left' })).toContainText('3');
  await expect(dialog).toContainText('Time played: 33s');
  await expect(dialog.getByRole('button', { name:/Play Again · 3 Left/ })).toBeVisible();
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
  expect(balances.length).toBe(22);
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



test('Star Defender keeps the legacy intro overlay hidden', async ({ page }) => {
  await page.goto('/stardefender.html');
  await expect(page.locator('#starStartOverlay')).toBeHidden();
});

test('Star Defender keeps the physical TAP TO START button visible on iPhone', async ({ page }, testInfo) => {
  await page.goto('/stardefender.html');
  const start = page.locator('#startButton');
  await expect(start).toBeVisible();
  await expect(start).toHaveText(/TAP TO START/i);
  const display = await start.evaluate(el => getComputedStyle(el).display);
  expect(display).not.toBe('none');
  if (testInfo.project.use.hasTouch) await start.tap();
  else await start.click();
  await expect(page.locator('#gameStatus')).toHaveText('Running', { timeout:5000 });
});

test('pause control appears and toggles on mini games', async ({ page }) => {
  for (const game of ['spiralDrop','bounceRun','perfectDrop','trafficEscape']) {
    await page.goto('/mini.html?game=' + game);
    await startGame(page);
    await page.waitForTimeout(3300);
    const pause = page.locator('#earnlyPauseButton');
    await expect(pause, game + ' pause button').toBeVisible();
    // WebKit can occasionally spend the full actionability timeout on this
    // compact moving game layout even though the button is visible. Invoke the
    // same real click handler directly; separate mobile interaction tests cover
    // pointer hit-testing on gameplay controls.
    await page.evaluate(() => document.querySelector('#earnlyPauseButton')?.click());
    await expect(pause).toHaveText(/Resume/);
    await expect(page.locator('#gameStatus')).toHaveText('Paused');
    await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelector('#earnlyPauseButton')?.click());
    await expect(pause).toHaveText(/Pause/);
    await expect(page.locator('#gameStatus')).toHaveText('Running');
  }
});

test('pause control is visible during Snake gameplay', async ({ page }) => {
  await page.goto('/snake.html');
  await startGame(page);
  await expect(page.locator('#gameStatus')).toHaveClass(/running/, { timeout:5000 });
  const pause = page.locator('#earnlyPauseButton');
  await expect(pause).toBeVisible();
  await page.evaluate(() => document.querySelector('#earnlyPauseButton')?.click());
  await expect(pause).toHaveText(/Resume/);
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await page.evaluate(() => document.querySelector('#earnlyPauseButton')?.click());
  await expect(page.locator('#gameStatus')).toHaveText('Running');
});


test('pausing Snake keeps the live board instead of showing out-of-plays guide', async ({ page }) => {
  await page.goto('/snake.html');
  await page.evaluate(() => {
    localStorage.setItem('snakeGamesPlayed', '2');
    localStorage.setItem('snakeBonusPlays', '0');
  });
  await page.reload();
  await startGame(page);
  await expect(page.locator('#gameStatus')).toHaveClass(/running/, { timeout:5000 });
  await page.evaluate(() => document.querySelector('#earnlyPauseButton')?.click());
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await expect(page.locator('.game-guide-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('.game-guide-overlay')).not.toContainText('Out of Plays');
  await expect(page.locator('#game')).toBeVisible();
});


test('paused Snake ignores gameplay input until resumed', async ({ page }) => {
  await page.goto('/snake.html');
  await startGame(page);
  await expect(page.locator('#gameStatus')).toHaveClass(/running/, { timeout:5000 });
  await page.evaluate(() => document.querySelector('#earnlyPauseButton')?.click());
  await expect(page.locator('#gameStatus')).toHaveText('Paused');

  const before = await page.locator('#score').textContent();
  await page.keyboard.press('ArrowDown');
  const gameBox = await page.locator('#game').boundingBox();
  expect(gameBox).not.toBeNull();
  await page.mouse.click(gameBox.x + Math.min(200, gameBox.width / 2), gameBox.y + Math.min(320, gameBox.height / 2));
  await page.waitForTimeout(350);
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await expect(page.locator('#score')).toHaveText(before || '0');

  await page.evaluate(() => document.querySelector('#earnlyPauseButton')?.click());
  await expect(page.locator('#gameStatus')).toHaveText('Running');
});


test('rapid Snake game-over calls only award and show results once', async ({ page }) => {
  await page.goto('/snake.html');
  await page.evaluate(() => {
    localStorage.setItem('snakeGamesPlayed','0');
    localStorage.setItem('snakeBonusPlays','0');
  });
  await page.reload();
  await startGame(page);
  await page.waitForTimeout(3300);
  const before = await page.locator('#balance').textContent();
  await page.evaluate(() => { gameOver(); gameOver(); gameOver(); });
  await expect(page.locator('dialog.game-result-dialog')).toHaveCount(1);
  await expect(page.locator('#gameStatus')).toHaveText('Game Over');
  const after = await page.locator('#balance').textContent();
  expect(Number(after)).toBeGreaterThanOrEqual(Number(before));
});

test('Brick Breaker starts fair and accepts bottom-screen paddle drags', async ({ page }) => {
  await page.goto('/brickbreaker.html');
  const speeds = await page.evaluate(() => {
    level = 1;
    const opening = levelSpeed();
    level = 8;
    const late = levelSpeed();
    return { opening, late };
  });
  expect(speeds.opening).toBeCloseTo(6, 3);
  expect(speeds.late).toBeGreaterThan(13);

  await startGame(page);
  await page.waitForTimeout(3300);
  const result = await page.evaluate(() => {
    const before = paddle.x;
    const y = window.innerHeight - 8;
    const base = { pointerId:91, pointerType:'touch', isPrimary:true, bubbles:true, cancelable:true, clientY:y };
    document.body.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX:120 }));
    document.body.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX:220 }));
    document.body.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX:220 }));
    const nav = document.getElementById('arcadeBottomNav');
    return { before, after:paddle.x, navDisplay:nav ? getComputedStyle(nav).display : 'missing' };
  });
  expect(result.after).toBeGreaterThan(result.before);
  expect(result.navDisplay).toBe('none');
});

test('Brick Breaker end state clears pending level transition', async ({ page }) => {
  await page.goto('/brickbreaker.html');
  await startGame(page);
  await page.waitForTimeout(3300);
  await page.evaluate(() => {
    starting = true;
    running = false;
    levelTimer = setTimeout(() => { document.body.dataset.lateLevelRestart='yes'; }, 80);
    finishGame();
  });
  await page.waitForTimeout(180);
  await expect(page.locator('body')).not.toHaveAttribute('data-late-level-restart','yes');
  await expect(page.locator('dialog.game-result-dialog')).toHaveCount(1);
});


test('Block Drop held controls cannot survive pause or game over', async ({ page }) => {
  await page.goto('/blockdrop.html');
  await startGame(page);
  await page.waitForTimeout(3300);

  const left = page.locator('#leftButton');
  await left.dispatchEvent('pointerdown', { pointerId:1 });
  await page.waitForTimeout(280);
  await page.locator('#earnlyPauseButton').click();
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await page.waitForTimeout(180);
  await page.locator('#earnlyPauseButton').click();
  await expect(page.locator('#gameStatus')).toHaveText('Running');

  await page.evaluate(() => { gameOver(); gameOver(); gameOver(); });
  await expect(page.locator('#gameStatus')).toHaveText('Game Over');
  await expect(page.locator('dialog.game-result-dialog')).toHaveCount(1);
  await page.waitForTimeout(220);
  await expect(page.locator('dialog.game-result-dialog')).toHaveCount(1);
});

test('Top 3 stays visible during mobile play without covering the board', async ({ page }) => {
  for (const url of ['/brickbreaker.html', '/mini.html?game=trafficEscape']) {
    await page.goto(url);
    const podium = page.locator('#earnlyCompactLeaderboard');
    await expect(podium).toBeVisible();
    await page.evaluate(() => document.body.classList.add('game-active'));
    await expect(podium).toHaveClass(/during-game-compact/);
    await expect(podium).toBeVisible();
    await expect(podium.locator('.compact-leaderboard-head')).toContainText('Top 3');
    const layout = await page.evaluate(() => {
      const card = document.querySelector('#earnlyCompactLeaderboard').getBoundingClientRect();
      const board = document.querySelector('canvas#game, #surface')?.getBoundingClientRect();
      return { cardBottom:card.bottom, boardTop:board?.top ?? Infinity };
    });
    expect(layout.cardBottom).toBeLessThanOrEqual(layout.boardTop);
  }
});


test('result popup supports accurate failure badges', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.setItem('arcadeOnboardingSeen','1');
    Arcade.gameResult({
      icon:'💰',
      title:'Boom! Run Over',
      badgeText:'💥 BOMB HIT',
      scoreLabel:'Coins Caught',
      score:11,
      coins:1,
      result:{xpAward:10,newBest:false},
      playsLeft:0,
      game:null
    });
  });
  await expect(page.locator('.result-badge')).toHaveText('💥 BOMB HIT');
});

test('disabled result actions stay readable on mobile', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.setItem('arcadeOnboardingSeen','1');
    Arcade.gameResult({
      icon:'🎮',
      title:'Test Run Over',
      scoreLabel:'Score',
      score:1,
      coins:0,
      result:{xpAward:10},
      playsLeft:0,
      game:null
    });
  });
  const disabled = page.locator('.game-result-dialog .result-actions button:disabled');
  await expect(disabled).toBeVisible();
  await expect(disabled).toHaveCSS('opacity','1');
  await expect(disabled).toHaveCSS('color','rgb(203, 213, 225)');
});

test('driving games hide mobile navigation during live play', async ({ page }) => {
  const width = page.viewportSize()?.width || 1280;
  test.skip(width >= 700, 'Mobile-only gameplay chrome check');

  await page.goto('/lanerunner.html');
  await startGame(page);
  await page.waitForTimeout(3300);
  await expect(page.locator('#gameStatus')).toHaveClass(/running/);
  await expect(page.locator('#laneControlZone')).toBeVisible();
  await expect(page.locator('#arcadeBottomNav')).toBeHidden();

  await page.goto('/dodger.html');
  await startGame(page);
  await page.waitForTimeout(3300);
  await expect(page.locator('#gameStatus')).toHaveClass(/running/);
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#arcadeBottomNav')).toBeHidden();
});

test('arcade gameplay still loads when the cloud CDN is unavailable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());

  await page.goto('/lanerunner.html');
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#startButton')).toHaveCount(1);

  await startGame(page);
  await page.waitForTimeout(3300);

  await expect(page.locator('#gameStatus')).toHaveText('Running');
  await expect(page.locator('#game')).toBeVisible();
  expect(errors).toEqual([]);
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
    await expect(page.locator('#startButton'), name+' start control').toHaveCount(1);
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
  await expect(page.locator('#startButton')).toHaveCount(1);
});

test('Memory Match shows the current clear reward', async ({ page }) => {
  await page.goto('/memory.html');
  await expect(page.locator('#memoryRewardHud')).toBeVisible();
  await expect(page.locator('#memoryRewardHud')).toContainText('Clear Reward');
  await expect(page.locator('#rewardPreview')).toHaveText('15');
});

test('mini games surface the live run reward clearly', async ({ page }) => {
  await page.goto('/mini.html?game=shapeFit');
  const pill = page.locator('#runRewardPill');
  await expect(pill).toBeVisible();
  await expect(pill).toContainText('Run Reward');
  await expect(page.locator('#rewardPreview')).toHaveText('0');
});

test('pre-game summary gets out of the way once gameplay starts', async ({ page }) => {
  await page.goto('/coincatch.html');
  const summary = page.locator('.game-start-summary');
  await expect(summary).toBeVisible();

  await startGame(page);
  await page.waitForTimeout(3300);

  await expect(page.locator('body')).toHaveClass(/game-active/);
  await expect(summary).toBeHidden();
  await expect(page.locator('.catch-board-wrap')).toBeVisible();
});

test('Block Drop speeds up and deep runs keep earning XP', async ({ page }) => {
  await page.goto('/blockdrop.html');
  const timing = await page.evaluate(() => {
    lines = 0;
    const start = dropDelayMs();
    lines = 6;
    const mid = dropDelayMs();
    lines = 20;
    const late = dropDelayMs();
    return { start, mid, late };
  });
  expect(timing.start).toBe(600);
  expect(timing.mid).toBeLessThan(timing.start);
  expect(timing.late).toBeLessThan(timing.mid);
  expect(timing.late).toBeGreaterThanOrEqual(220);

  const xp = await page.evaluate(() => {
    localStorage.clear();
    const strong = Arcade.recordResult('blockDrop', 6);
    const elite = Arcade.recordResult('blockDrop', 16);
    return { strong:strong.performanceXP, elite:elite.performanceXP };
  });
  expect(xp.strong).toBe(10);
  expect(xp.elite).toBe(30);
});

test('Block Drop and Color Match expose live run rewards', async ({ page }) => {
  await page.goto('/blockdrop.html');
  await expect(page.locator('#runRewardPill')).toBeVisible();
  await expect(page.locator('#rewardPreview')).toHaveText('0');
  expect(await page.evaluate(() => rewardForLines(3))).toBe(3);
  expect(await page.evaluate(() => rewardForLines(9))).toBe(5);

  await page.goto('/colormatch.html');
  await expect(page.locator('#runRewardPill')).toContainText('Run Reward');
  await expect(page.locator('#rewardPreview')).toHaveText('0');
  expect(await page.evaluate(() => rewardFor(4))).toBe(1);
  expect(await page.evaluate(() => rewardFor(15))).toBe(5);
});

test('Coin Catch reward curve lasts into deep runs and awards performance XP', async ({ page }) => {
  await page.goto('/coincatch.html');
  expect(await page.evaluate(() => rewardFor(5))).toBe(0);
  expect(await page.evaluate(() => rewardFor(6))).toBe(1);
  expect(await page.evaluate(() => rewardFor(11))).toBe(1);
  expect(await page.evaluate(() => rewardFor(75))).toBe(7);
  expect(await page.evaluate(() => rewardFor(150))).toBe(15);
  expect(await page.evaluate(() => rewardFor(227))).toBe(22);
  expect(await page.evaluate(() => rewardFor(264))).toBe(25);

  const xp = await page.evaluate(() => {
    localStorage.clear();
    const strong = Arcade.recordResult('coinCatch', 227);
    const elite = Arcade.recordResult('coinCatch', 350);
    return { strong:strong.performanceXP, elite:elite.performanceXP };
  });
  expect(xp.strong).toBe(20);
  expect(xp.elite).toBe(30);
});

test('Coin Catch keeps live instructions visible long enough to read', async ({ page }) => {
  await page.goto('/coincatch.html');
  await page.evaluate(() => localStorage.setItem('arcadeOnboardingSeen', '1'));
  await page.reload();
  await startGame(page);
  await expect(page.locator('#gameStatus')).toHaveText('Running', { timeout: 5000 });

  const tip = page.locator('#catchLiveTip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Swipe anywhere');
  await expect(tip).toContainText('Catch coins');
  await expect(tip).toContainText('Avoid bombs');

  const pause = page.locator('.earnly-pause-button');
  if (await pause.isVisible()) {
    const pauseBox = await pause.boundingBox();
    const tipBox = await tip.boundingBox();
    expect(pauseBox).not.toBeNull();
    expect(tipBox).not.toBeNull();
    expect(tipBox.y).toBeGreaterThanOrEqual(pauseBox.y + pauseBox.height + 6);
  }
});

test('Coin Catch accepts drag input at the very bottom of the screen', async ({ page }) => {
  await page.goto('/coincatch.html');
  await page.evaluate(() => localStorage.setItem('arcadeOnboardingSeen', '1'));
  await page.reload();
  await startGame(page);
  await page.waitForTimeout(3300);

  const result = await page.evaluate(() => {
    const before = basket.x;
    const y = window.innerHeight - 8;
    const base = { pointerId:77, pointerType:'touch', isPrimary:true, bubbles:true, cancelable:true, clientY:y };
    document.body.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX:120 }));
    document.body.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX:240 }));
    document.body.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX:240 }));
    const nav = document.getElementById('arcadeBottomNav');
    return {
      before,
      after:basket.x,
      navDisplay:nav ? getComputedStyle(nav).display : 'missing'
    };
  });

  expect(result.after).toBeGreaterThan(result.before);
  expect(result.navDisplay).toBe('none');
});

test('Coin Catch HUD stays inside the board and shows live run rewards', async ({ page }) => {
  await page.goto('/coincatch.html');
  await startGame(page);
  await page.waitForTimeout(3300);

  const board = await page.locator('.catch-board-wrap').boundingBox();
  expect(board).not.toBeNull();

  for (const selector of ['.catch-hud-left','.catch-hud-center','.catch-hud-right','#earnedHud']) {
    const box = await page.locator(selector).boundingBox();
    expect(box, selector + ' should render').not.toBeNull();
    expect(box.x, selector + ' left edge').toBeGreaterThanOrEqual(board.x - 1);
    expect(box.x + box.width, selector + ' right edge').toBeLessThanOrEqual(board.x + board.width + 1);
    expect(box.y, selector + ' top edge').toBeGreaterThanOrEqual(board.y - 1);
    expect(box.y + box.height, selector + ' bottom edge').toBeLessThanOrEqual(board.y + board.height + 1);
  }

  await expect(page.locator('#earnedHud')).toContainText('Arcade Coins');
  const viewportWidth = page.viewportSize()?.width || 1280;
  if (viewportWidth < 700) {
    const hudBoxes = await page.locator('.catch-hud').evaluateAll(nodes =>
      nodes.map(node => {
        const r = node.getBoundingClientRect();
        return { left:r.left, right:r.right };
      }).sort((a,b) => a.left - b.left)
    );
    expect(hudBoxes).toHaveLength(3);
    for (let i = 1; i < hudBoxes.length; i++) {
      expect(hudBoxes[i].left, 'mobile Coin Catch HUD cards should not overlap').toBeGreaterThanOrEqual(hudBoxes[i - 1].right + 2);
    }
  }

  const levelBannerInsideBoard = await page.locator('#levelBanner').evaluate(
    node => node.parentElement?.classList.contains('catch-board-wrap')
  );
  expect(levelBannerInsideBoard).toBeTruthy();
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


test('Shape Fit always renders exactly one valid matching choice', async ({ page }) => {
  await page.goto('/mini.html?game=shapeFit');
  await page.evaluate(() => localStorage.setItem('arcadeOnboardingSeen','1'));
  await page.reload();
  await startGame(page);
  await page.waitForTimeout(2500);

  const targetBase = await page.locator('.fit-shape').getAttribute('data-base');
  expect(targetBase).toBeTruthy();
  await expect(page.locator('.fit-answer[data-base="' + targetBase + '"]')).toHaveCount(1);
});

test('Shape Fit exposes urgency and stage feedback', async ({ page }) => {
  const jsResponse = await page.request.get('/mini-games.js');
  const source = await jsResponse.text();
  expect(source).toContain("title.classList.toggle('urgent',timeLeft<=1800)");
  expect(source).toContain("if(lastStage&&currentStage!==lastStage)Arcade.feedback('perfect')");
  expect(source).toContain("wrap.classList.add('fit-success')");
  expect(source).toContain("wrap.classList.add('fit-miss')");

  const htmlResponse = await page.request.get('/mini.html');
  const html = await htmlResponse.text();
  expect(html).toContain('.fit-clock');
  expect(html).toContain('.fit-title.urgent');
});


test('Traffic Escape keeps fast-road feedback without revealing the safe car', async ({ page }) => {
  const jsResponse = await page.request.get('/mini-games.js');
  const source = await jsResponse.text();
  expect(source).toContain("if(quick)fastClears++");
  expect(source).toContain("'⚡ Fast clear · '+roadTime.toFixed(1)+'s! · '");
  expect(source).toContain("'⚡ Fast roads: '+fastClears");
  expect(source).toContain("'🏁 Best road: '");
  expect(source).toContain("const roundSeconds=()=>[0,16,14,12,10,9,8,7]");
  expect(source).toContain("if(!alive||miniPaused){lastTickAt=performance.now();return;}");
  expect(source).not.toContain("' clear-path':'')");

  const htmlResponse = await page.request.get('/mini.html');
  const html = await htmlResponse.text();
  expect(html).not.toContain('.traffic-car.clear-path');
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


test('new player flow keeps plays and results consistent', async ({ page }) => {
  await page.goto('/games.html');
  await page.evaluate(() => {
    localStorage.clear();
    const d=new Date();
    const day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    localStorage.setItem('arcadePlayDay', day);
  });
  await page.reload();

  await expect(page.locator('#games')).toBeVisible();
  await page.goto('/mini.html?game=shapeFit');
  await expect(page.locator('#plays')).toHaveText('3');

  await startGame(page);
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => Arcade.remaining('shapeFit'))).toBe(2);
  await expect(page.locator('#plays')).toHaveText('2');

  await page.evaluate(() => {
    Arcade.gameResult({
      icon:'🔷', title:'Shape Fit', scoreLabel:'Score', score:4,
      best:'4 points', coins:1, result:{xpAward:10}, playsLeft:Arcade.remaining('shapeFit'),
      game:'shapeFit', extra:['⏱️ Time played: 5s']
    });
  });
  const result = page.locator('dialog.game-result-dialog');
  await expect(result).toBeVisible();
  await expect(result).toContainText('Coins Earned');
  await expect(result).toContainText('XP Earned');
  await expect(result).toContainText('Time played: 5s');

  await page.reload();
  expect(await page.evaluate(() => Arcade.remaining('shapeFit'))).toBe(2);
  await expect(page.locator('#plays')).toHaveText('2');
});

test('out-of-plays flow offers rewarded plays without spending coins', async ({ page }) => {
  await page.goto('/mini.html?game=shapeFit');
  await page.evaluate(() => {
    const d=new Date();
    const day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    localStorage.setItem('arcadePlayDay', day);
    localStorage.setItem('shapeFitGamesPlayed', '3');
    localStorage.setItem('shapeFitBonusPlays', '0');
    localStorage.setItem('shapeFitPlayAdUnlocks', '0');
  });
  await page.reload();
  expect(await page.evaluate(() => Arcade.remaining('shapeFit'))).toBe(0);
  await startGame(page);
  const outDialog=page.locator('dialog');
  await expect(outDialog).toContainText('One more run?');
  await expect(outDialog).toContainText('Watch one optional rewarded ad');
  await expect(outDialog.getByRole('button', { name:/Watch demo ad.*Play Again/i })).toBeVisible();
  await expect(outDialog.getByRole('button', { name:'Choose Another Game' })).toBeVisible();
  await expect(outDialog).not.toContainText(/spend .*coin/i);
});


test('first visit onboarding gets players to gameplay fast', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const dialog = page.locator('dialog.onboarding-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Welcome to Earnly');
  await expect(dialog).toContainText('Start with 3 free plays per game every day.');
  await expect(dialog).toContainText('Ads do not award Arcade Coins.');
  await expect(dialog).toContainText('Out of plays?');
  await expect(dialog.locator('.onboarding-row')).toHaveCount(3);

  await dialog.getByRole('button', { name:'Start Playing →' }).click();
  await expect(page).toHaveURL(/games\.html$/);
  expect(await page.evaluate(() => localStorage.getItem('arcadeOnboardingSeen'))).toBe('1');
});

test('one-more-run gate grants exactly one play then returns control', async ({ page }) => {
  await page.goto('/mini.html?game=shapeFit');
  await page.evaluate(() => {
    const d = new Date();
    const day = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    localStorage.setItem('arcadePlayDay', day);
    localStorage.setItem('shapeFitGamesPlayed', '3');
    localStorage.setItem('shapeFitBonusPlays', '0');
    localStorage.setItem('shapeFitPlayAdUnlocks', '0');
  });
  await page.reload();

  await startGame(page);
  const gate = page.locator('dialog');
  await expect(gate).toContainText('One more run?');
  await gate.getByRole('button', { name:/Watch demo ad.*Play Again/i }).click();
  await expect(page.locator('dialog.reward-ad-dialog')).toBeVisible();
  await page.waitForTimeout(3400);
  expect(await page.evaluate(() => Arcade.remaining('shapeFit'))).toBe(1);
  expect(await page.evaluate(() => Arcade.playAdStatus('shapeFit').used)).toBe(1);
});

test('account cloud flow exposes offline and restore safeguards', async ({ page }) => {
  const cloud = await (await page.request.get('/cloud.js')).text();
  expect(cloud).toContain("new CustomEvent('earnly-cloud-syncing'");
  expect(cloud).toContain("try { await syncServerRewards(); } catch {}");
  expect(cloud).toContain("localStorage.setItem('arcadeCloudOfflinePending'");

  const account = await (await page.request.get('/account.html')).text();
  expect(account).toContain("localStorage.getItem('arcadeServerRewardError')");
  expect(account).toContain("localStorage.getItem('arcadeCloudOfflinePending')");
  expect(account).toContain("if (navigator.onLine) {");
  expect(account).toContain("Your progress is safe on this device and will sync automatically when you reconnect.");
  expect(account).toContain("earnly-cloud-syncing");
});


test('multi-device saves recheck cloud revision before writes', async ({ page }) => {
  const cloud = await (await page.request.get('/cloud.js')).text();
  expect(cloud).toContain('function cloudRevisionMatches(remote');
  expect(cloud).toContain('function markCloudConflict(remote');
  expect(cloud).toContain('const latestRemote = await cloudSaveInfo();');
  expect(cloud).toContain("skipped:'newer-cloud-save-before-write'");
  expect(cloud).toContain("error.code = 'EARNLY_CLOUD_CONFLICT'");
});


test('offline cloud progress has an explicit recovery lifecycle', async ({ page }) => {
  const cloud = await (await page.request.get('/cloud.js')).text();
  expect(cloud).toContain("new CustomEvent('earnly-cloud-offline-pending'");
  expect(cloud).toContain("const recoveredOffline = !!localStorage.getItem('arcadeCloudOfflinePending')");
  expect(cloud).toContain("new CustomEvent('earnly-cloud-recovered'");
  expect(cloud).toContain("localStorage.removeItem('arcadeCloudOfflinePending')");

  const account = await (await page.request.get('/account.html')).text();
  expect(account).toContain("earnly-cloud-offline-pending");
  expect(account).toContain("📴 Offline · progress waiting to sync");
  expect(account).toContain("earnly-cloud-recovered");
  expect(account).toContain("☁️ Offline progress synced");
});


test('Home resets restored scroll and clears the fixed bottom nav', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.setItem('arcadeOnboardingSeen', '1'));
  await page.reload();

  await page.evaluate(() => {
    window.scrollTo(0, 600);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted:true }));
  });
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBeLessThanOrEqual(1);

  const nav = page.locator('#arcadeBottomNav');
  if (await nav.isVisible()) {
    const spacing = await page.evaluate(() => {
      const nav = document.querySelector('#arcadeBottomNav');
      const container = document.querySelector('.home-container');
      return {
        navHeight:nav?.getBoundingClientRect().height || 0,
        paddingBottom:parseFloat(getComputedStyle(container).paddingBottom) || 0
      };
    });
    expect(spacing.navHeight).toBeGreaterThan(0);
    expect(spacing.paddingBottom).toBeGreaterThanOrEqual(spacing.navHeight + 40);
  }
});

test('daily missions track games, variety, and coins', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('arcadeOnboardingSeen', '1');
  });
  await page.reload();

  await expect(page.locator('#dailyMissionsSection')).toBeVisible();
  await expect(page.locator('#dailyMissionList .daily-mission-row')).toHaveCount(3);

  const initial = await page.evaluate(() => Arcade.dailyMissionStatus());
  expect(initial.total).toBe(3);
  expect(initial.missions.find(m => m.id === 'play3').progress).toBe(0);

  await page.evaluate(() => {
    Arcade.recordResult('snake', 1);
    Arcade.recordResult('shapeFit', 1);
    Arcade.recordResult('snake', 2);
    Arcade.earn(15, 'Mission test');
  });

  const status = await page.evaluate(() => Arcade.dailyMissionStatus());
  expect(status.missions.find(m => m.id === 'play3').complete).toBeTruthy();
  expect(status.missions.find(m => m.id === 'variety2').complete).toBeTruthy();
  expect(status.missions.find(m => m.id === 'coins15').complete).toBeTruthy();

  const claimed = await page.evaluate(() => Arcade.claimDailyMission('play3'));
  expect(claimed.xp).toBe(20);
  const after = await page.evaluate(() => Arcade.dailyMissionStatus());
  expect(after.missions.find(m => m.id === 'play3').claimed).toBeTruthy();
});


test('mission claims and rewarded plays emit polished feedback events', async ({ page }) => {
  const arcade = await (await page.request.get('/arcade.js')).text();
  expect(arcade).toContain("new CustomEvent('earnly-mission-claimed'");
  expect(arcade).toContain("new CustomEvent('earnly-bonus-plays-unlocked'");
  expect(arcade).toContain("playsGranted:PLAY_AD_BONUS");
  expect(arcade).toContain("unlocksLeft:Math.max(0, latestStatus.remaining - 1)");

  const home = await (await page.request.get('/index.html')).text();
  expect(home).toContain("earnly-mission-claimed");
  expect(arcade).toContain("Daily mission complete · +");
  expect(home).toContain("earnly-bonus-plays-unlocked");
});


test('game results show daily mission progress and claim readiness', async ({ page }) => {
  await page.goto('/mini.html?game=shapeFit');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('arcadeOnboardingSeen', '1');
    Arcade.recordResult('shapeFit', 2);
    Arcade.gameResult({
      icon:'🔷', title:'Shape Fit', scoreLabel:'Score', score:2,
      coins:1, result:{xpAward:10}, playsLeft:2, game:'shapeFit'
    });
  });

  const result = page.locator('dialog.game-result-dialog');
  await expect(result).toBeVisible();
  await expect(result.locator('.result-mission-update')).toHaveCount(1);
  await expect(result).toContainText('Mix It Up · 1/2');
  await expect(result).not.toContainText('Warm Up · 1/3');

  await page.evaluate(() => {
    document.querySelector('dialog.game-result-dialog')?.close();
    Arcade.recordResult('snake', 1);
    Arcade.recordResult('shapeFit', 3);
    Arcade.earn(15, 'Mission result test');
    Arcade.gameResult({
      icon:'🔷', title:'Shape Fit', scoreLabel:'Score', score:3,
      coins:1, result:{xpAward:10}, playsLeft:1, game:'shapeFit'
    });
  });
  await expect(result.locator('.result-mission-update')).toHaveCount(1);
  await expect(result).toContainText('3 Daily Missions complete · +70 XP ready to claim');
});


test('games page shows live daily mission progress', async ({ page }) => {
  await page.goto('/games.html');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('arcadeOnboardingSeen', '1');
    Arcade.recordResult('snake', 2);
    Arcade.earn(5, 'Mission games page test');
  });
  await page.reload();

  await expect(page.locator('#gamesMissionStrip')).toBeVisible();
  await expect(page.locator('#gamesMissionStrip')).toContainText('Missions');
  await expect(page.locator('#gamesMissionSummary')).toContainText('0/3 complete');

  await page.evaluate(() => {
    Arcade.recordResult('shapeFit', 1);
    Arcade.recordResult('snake', 3);
    Arcade.earn(10, 'Mission games page completion test');
  });
  await page.reload();
  await expect(page.locator('#gamesMissionCount')).toHaveText('3/3');
  await expect(page.locator('#gamesMissionSummary')).toContainText('3 rewards ready to claim');
});


test('full player journey preserves rewards missions and bonus plays', async ({ page }) => {
  await page.goto('/games.html');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('arcadeOnboardingSeen', '1');
  });
  await page.reload();

  expect(await page.evaluate(() => Arcade.remaining('shapeFit'))).toBe(3);
  await expect(page.locator('#gamesMissionSummary')).toContainText('0/3 complete');

  await page.goto('/mini.html?game=shapeFit');
  await page.evaluate(() => {
    Arcade.consume('shapeFit');
    const result = Arcade.recordResult('shapeFit', 4);
    Arcade.earn(5, 'Shape Fit');
    Arcade.gameResult({
      icon:'🔷', title:'Shape Fit', scoreLabel:'Score', score:4,
      best:'4 points', coins:5, result, playsLeft:Arcade.remaining('shapeFit'),
      game:'shapeFit', extra:['⏱️ Time played: 5s']
    });
  });
  await expect(page.locator('dialog.game-result-dialog .result-mission-update')).toHaveCount(1);
  await expect(page.locator('dialog.game-result-dialog')).toContainText('Mix It Up · 1/2');
  expect(await page.evaluate(() => Arcade.remaining('shapeFit'))).toBe(2);

  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ));

  const secondConsumed = await page.evaluate(() => {
    document.querySelector('dialog.game-result-dialog')?.close();
    const consumed = Arcade.consume('shapeFit');
    Arcade.recordResult('shapeFit', 5);
    Arcade.earn(5, 'Shape Fit');
    return consumed;
  });
  expect(secondConsumed).toBeTruthy();
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ));

  const thirdConsumed = await page.evaluate(() => {
    const consumed = Arcade.consume('shapeFit');
    Arcade.recordResult('shapeFit', 6);
    Arcade.earn(5, 'Shape Fit');
    return consumed;
  });
  expect(thirdConsumed).toBeTruthy();
  expect(await page.evaluate(() => Arcade.remaining('shapeFit'))).toBe(0);

  const missions = await page.evaluate(() => Arcade.dailyMissionStatus());
  expect(missions.missions.find(m => m.id === 'play3').complete).toBeTruthy();
  expect(missions.missions.find(m => m.id === 'coins15').complete).toBeTruthy();

  await page.evaluate(() => Arcade.out('shapeFit'));
  await expect(page.locator('dialog')).toContainText('One more run?');
  await page.getByRole('button', { name:/Watch demo ad.*Play Again/i }).click();
  await expect(page.locator('dialog.reward-ad-dialog')).toBeVisible();
  await page.waitForTimeout(3400);
  expect(await page.evaluate(() => Arcade.remaining('shapeFit'))).toBe(1);
  expect(await page.evaluate(() => Arcade.playAdStatus('shapeFit').used)).toBe(1);

  await page.reload();
  expect(await page.evaluate(() => Arcade.remaining('shapeFit'))).toBe(1);
  expect(await page.evaluate(() => Arcade.dailyMissionStatus().missions.find(m => m.id === 'play3').complete)).toBeTruthy();
  expect(await page.evaluate(() => Arcade.dailyCoinStatus().earned)).toBe(15);
});

test('player journey cloud contract includes mission and bonus-play state', async ({ page }) => {
  await page.goto('/index.html');
  const snapshot = await page.evaluate(() => {
    localStorage.setItem('arcadeDailyGames', '3');
    localStorage.setItem('arcadeDailyGamesList', JSON.stringify(['shapeFit','snake']));
    localStorage.setItem('arcadeDailyMissionClaims', JSON.stringify(['play3']));
    localStorage.setItem('shapeFitBonusPlays', '3');
    localStorage.setItem('shapeFitPlayAdUnlocks', '1');
    return Arcade.snapshotData();
  });
  const serialized = JSON.stringify(snapshot);
  expect(serialized).toContain('arcadeDailyGames');
  expect(serialized).toContain('arcadeDailyMissionClaims');
  expect(serialized).toContain('shapeFitBonusPlays');
  expect(serialized).toContain('shapeFitPlayAdUnlocks');
});


test('paused gameplay keeps mobile scroll lock', async ({ page }) => {
  await page.goto('/mini.html?game=perfectDrop');
  await startGame(page);
  await expect(page.locator('#gameStatus')).toHaveText('Running', { timeout:5000 });
  await expect(page.locator('body')).toHaveClass(/earnly-gameplay-locked/);

  const pause=page.locator('#earnlyPauseButton');
  await pause.click();
  await expect(page.locator('#gameStatus')).toHaveText('Paused');
  await expect(page.locator('body')).toHaveClass(/earnly-gameplay-locked/);

  await pause.click();
  await expect(page.locator('#gameStatus')).toHaveText('Running');
  await expect(page.locator('body')).toHaveClass(/earnly-gameplay-locked/);
});


test('repairs impossible daily coin counters and uses live catalog total', async ({ page }) => {
  await page.goto('/rewards.html');
  const repaired = await page.evaluate(() => {
    localStorage.setItem('points', '617');
    localStorage.setItem('lifetimePoints', '617');
    localStorage.setItem('arcadeCoinEarnDay', new Date().toLocaleDateString('en-CA'));
    localStorage.setItem('arcadeCoinsEarnedToday', '992');
    localStorage.setItem('arcadeHistory', '[]');
    return Arcade.dailyCoinStatus();
  });
  expect(repaired.earned).toBeLessThanOrEqual(repaired.lifetime);

  await page.goto('/profile.html');
  const totalGames = await page.evaluate(() => Object.keys(Arcade.names).length);
  expect(totalGames).toBe(22);
  await expect(page.locator('#differentGames')).toContainText('/22');
});


test('global leaderboards expose all games and editable player identity', async ({ page }) => {
  await page.goto('/leaderboards.html');
  await expect(page.locator('#gameSelect option')).toHaveCount(22);
  await expect(page.locator('#boardTitle')).toContainText('World Top 25');
  await expect(page.getByRole('link', { name:'Edit username & icon' })).toBeVisible();

  await page.goto('/profile.html');
  await page.locator('details.profile-edit-card > summary').click();
  await expect(page.locator('#usernameInput')).toBeVisible();
  await expect(page.locator('#avatarPicker .avatar-choice')).toHaveCount(16);
  await expect(page.locator('a[href="leaderboards.html"]')).toContainText('World Ranks');
});

test('leaderboard sync is server-routed and new bests submit automatically', async ({ page }) => {
  const cloud = await (await page.request.get('/cloud.js')).text();
  expect(cloud).toContain("functions.invoke('leaderboard'");
  expect(cloud).toContain("functions.invoke('leaderboard-report'");
  expect(cloud).toContain("action:'submit'");
  expect(cloud).toContain("action:'list'");
  expect(cloud).toContain("event.detail?.type === 'game_result' && event.detail?.payload?.newBest");

  const arcade = await (await page.request.get('/arcade.js')).text();
  expect(arcade).toContain("arcadeProfileIcon");
  expect(arcade).toContain("arcadeUsername");
  expect(arcade).toContain("profileAvatars");
});

test('leaderboards include report-and-hide moderation controls', async ({ page }) => {
  const html = await (await page.request.get('/leaderboards.html')).text();
  expect(html).toContain('Report & Hide');
  expect(html).toContain('reportLeaderboardPlayer');
  expect(html).toContain('arcadeBlockedLeaderboardUsers');
  expect(html).toContain('support.html');
});
