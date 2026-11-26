const { test, expect } = require('@playwright/test');

for (const prefix of ['', '/www']) {
  test(`${prefix || '/'} Spuddy Defense is listed and starts a local defense`, async ({ page }) => {
    await page.goto(`${prefix}/games.html`);
    await page.locator('[data-filter=all]').click();

    const card = page.locator('#games [data-game=spuddyDefense]');
    await expect(card).toBeVisible();
    await expect(card.locator('.game-play-button')).toHaveAttribute('href', 'spuddy-defense.html');

    await card.locator('.game-play-button').click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/spuddy-defense\\.html$`));
    await page.locator('#play').click();

    await expect(page.locator('#game')).toBeVisible();
    await expect(page.locator('#lives')).toHaveText('100');
    await expect(page.locator('#money')).toHaveText('650');
    await expect(page.locator('#nextWave')).toContainText('Start wave 1');
  });
}
