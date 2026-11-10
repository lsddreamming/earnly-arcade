const { test, expect } = require('@playwright/test');

for (const prefix of ['/', '/www/']) {
  test(prefix + 'Evolution beta is discoverable, free, favoritable and directly linked', async ({ page }) => {
    await page.goto(prefix + 'games.html');
    const cards = page.locator('#games [data-game="spuddyEvolution"]');
    await expect(cards).toHaveCount(1);
    const card = cards.first();
    await expect(card).toBeVisible();
    await expect(page.locator('#games .catalog-tile').last()).toHaveAttribute('data-game', 'spuddyEvolution');
    await expect(card.locator('.reward-rule')).toContainText('device-only saves');
    await expect(card.locator('.reward-rule')).toContainText('no Arcade Coin rewards');
    await expect(card.locator('.game-play-button')).toHaveText('Play · Free beta');
    await expect(card.locator('.game-play-button')).toHaveAttribute('href', 'spuddy-evolution.html');
    await expect(card.locator('.status-line')).toHaveCount(0);

    await page.getByRole('button', { name: 'Add Spuddy Evolution favorite', exact: true }).click();
    await page.locator('[data-filter="favorites"]').click();
    await expect(cards).toHaveCount(1);
    await page.locator('[data-filter="new"]').click();
    await expect(cards).toHaveCount(1);
    await page.locator('[data-filter="action"]').click();
    await expect(cards).toHaveCount(1);
    await page.locator('#gameSearch').fill('Spuddy Evolution');
    await expect(page.locator('#games .catalog-tile')).toHaveCount(1);
    await expect(page.locator('#gameBrowseCount')).toHaveText('1 game found');

    // Check actual navigation without starting WebGL or altering the player's save.
    await card.locator('.game-play-button').click();
    await expect(page).toHaveURL(new RegExp(prefix.replace(/\//g, '\\/') + 'spuddy-evolution\\.html$'));
    await expect(page).toHaveTitle('Spuddy Evolution · Earnly Arcade');
  });
}
