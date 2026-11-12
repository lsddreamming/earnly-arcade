const { test, expect } = require('@playwright/test');
for (const prefix of ['', 'www/']) {
  test(`${prefix}daily missions deep link expands the target disclosure`, async ({ page }) => {
    await page.goto(`/${prefix}index.html#dailyMissionsSection`);
    const target = page.locator('#dailyMissionsSection');
    await expect(target).toHaveAttribute('open', '');
    await expect(target.locator('#challengeCard')).toBeVisible();
    await expect(target.locator('xpath=ancestor::details')).toHaveAttribute('open', '');
  });

  test(`${prefix}Games mission shortcut reveals the Daily Challenges card`, async ({ page }) => {
    await page.goto(`/${prefix}games.html`);
    await page.locator('#gamesMissionStrip').click();
    await expect(page).toHaveURL(new RegExp(`/${prefix}index\\.html#dailyMissionsSection$`));
    const target = page.locator('#dailyMissionsSection');
    await expect(target).toHaveAttribute('open', '');
    await expect(target.locator('#challengeCard')).toBeVisible();
    await expect(target.locator('xpath=ancestor::details')).toHaveAttribute('open', '');
  });

  test(`${prefix}same-page mission hashchange expands closed details`, async ({ page }) => {
    await page.goto(`/${prefix}index.html`);
    await page.evaluate(() => {
      const target = document.getElementById('dailyMissionsSection');
      for (let node = target; node; node = node.parentElement) {
        if (node.tagName === 'DETAILS') node.open = false;
      }
      location.hash = '#dailyMissionsSection';
    });
    const target = page.locator('#dailyMissionsSection');
    await expect(target).toHaveAttribute('open', '');
    await expect(target.locator('#challengeCard')).toBeVisible();
    await expect(target.locator('xpath=ancestor::details')).toHaveAttribute('open', '');
  });
}
