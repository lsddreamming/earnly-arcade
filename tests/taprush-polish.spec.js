const { test, expect } = require('@playwright/test');

async function start(page) {
  await page.addInitScript(() => localStorage.setItem('arcadeOnboardingSeen', '1'));
  await page.goto('/taprush.html');
  if(await page.locator('#startButton').isVisible()) await page.locator('#startButton').click();
  else await page.locator('#board').click();
  await expect(page.locator('#gameStatus')).toHaveText('Running');
}
async function hit(page) {
  await page.locator('#target').dispatchEvent('pointerdown', { pointerType:'touch', isPrimary:true, bubbles:true });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('Tap Rush earns gold bonuses and ramps stages without inflating hit scores', async ({page}) => {
  await start(page);
  for(let i=0;i<6;i++) await hit(page);
  await expect(page.locator('#target')).toHaveClass(/gold/);
  await hit(page);
  await expect(page.locator('#hits')).toHaveText('7');
  await expect(page.locator('#rewardPreview')).toHaveText('2');
  for(let i=7;i<10;i++) await hit(page);
  await expect(page.locator('#rushStage')).toContainText('Stage 2');
  await expect(page.locator('#rushStreak')).toContainText('Rush · 10');
  expect(await page.evaluate(() => targetExpiresAt-performance.now())).toBeLessThan(1550);
  await page.evaluate(() => finishGame());
  await expect(page.locator('dialog.game-result-dialog')).toContainText('Best streak: 10');
  expect(await page.evaluate(() => rewardForHits(200))).toBe(20);
});

test('Tap Rush rejects late target taps and resets the streak on expiry', async ({page}) => {
  await start(page);
  await hit(page);
  await page.evaluate(() => {
    targetExpiresAt = performance.now()-1;
    target.dispatchEvent(new PointerEvent('pointerdown', {pointerType:'touch', isPrimary:true, bubbles:true}));
  });
  await expect(page.locator('#hits')).toHaveText('1');
  await expect(page.locator('#rushStreak')).toHaveText('0 streak');
  expect(await page.evaluate(() => expiredTargets)).toBe(1);
});

test('Tap Rush pause freezes target expiry and Quit cancel preserves play', async ({page}) => {
  await start(page);
  await hit(page);
  await page.locator('#earnlyPauseButton').click();
  const frozen = await page.evaluate(() => ({serial:targetSerial, hits, expiry:targetExpiresAt}));
  await page.waitForTimeout(1900);
  expect(await page.evaluate(() => targetSerial)).toBe(frozen.serial);
  await page.locator('#earnlyPauseButton').click();
  expect(await page.evaluate(() => targetExpiresAt-performance.now())).toBeGreaterThan(700);
  await page.locator('#earnlyQuitButton').click();
  await expect(page.locator('.earnly-quit-dialog')).toBeVisible();
  await page.locator('[data-keep]').click();
  await expect(page.locator('#gameStatus')).toHaveText('Running');
  await hit(page);
  await expect(page.locator('#hits')).toHaveText('2');
});

test('Tap Rush compact controls sit below the board and replay clears streaks', async ({page,isMobile}) => {
  await start(page);
  const pauseBox = await page.locator('#earnlyPauseButton').boundingBox();
  expect(pauseBox.y+pauseBox.height).toBeLessThan(page.viewportSize().height);
  if(isMobile) {
    const board=await page.locator('#board').boundingBox();
    const pause=await page.locator('#earnlyPauseButton').boundingBox();
    expect(pause.y).toBeGreaterThan(board.y+board.height);
    expect(pause.y-(board.y+board.height)).toBeLessThan(40);
    expect(pause.y+pause.height).toBeLessThan(page.viewportSize().height);
  }
  await hit(page);
  await page.evaluate(() => finishGame());
  await page.locator('dialog.game-result-dialog .result-actions button.green').click();
  await expect(page.locator('#gameStatus')).toHaveText('Running');
  await expect(page.locator('#rushStreak')).toHaveText('0 streak');
  await expect(page.locator('#hits')).toHaveText('0');
  expect(await page.evaluate(() => ({bonusCoins,bestStreak,expiredTargets}))).toEqual({bonusCoins:0,bestStreak:0,expiredTargets:0});
});
