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
