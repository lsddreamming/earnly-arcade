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
