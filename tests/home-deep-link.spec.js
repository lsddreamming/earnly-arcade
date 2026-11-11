const { test, expect } = require('@playwright/test');
for (const prefix of ['', 'www/']) {
  test(`${prefix}daily missions deep link expands the target disclosure`, async ({ page }) => {
    await page.goto(`/${prefix}index.html#dailyMissionsSection`);
    const target = page.locator('#dailyMissionsSection');
    await expect(target).toHaveAttribute('open', '');
    await expect(target.locator('#challengeCard')).toBeVisible();
    await expect(target.locator('xpath=ancestor::details')).toHaveAttribute('open', '');
  });
}
