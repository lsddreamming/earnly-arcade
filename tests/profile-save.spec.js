const { test, expect } = require('@playwright/test');
test('profile draft survives refresh and saves the typed username', async ({ page }) => {
  await page.route('**/cloud.js', route => route.fulfill({contentType:'text/javascript', body:`window.EarnlyCloud={profile:async()=>null,updatePublicProfile:async(data)=>{window.savedProfile=data;localStorage.setItem('arcadeUsername',data.username);return {username:data.username};}};`}));
  await page.goto('/profile.html');
  await page.locator('details.profile-edit-card > summary').click();
  await page.locator('#nameInput').fill('Test Player');
  await page.locator('#usernameInput').fill('Shrimp92');
  await page.locator('#usernameInput').blur();
  await page.evaluate(()=>window.dispatchEvent(new Event('earnly-cloud-synced')));
  await expect(page.locator('#usernameInput')).toHaveValue('Shrimp92');
  await page.locator('#saveProfileButton').click();
  await expect(page.locator('#globalProfileStatus')).toContainText('@Shrimp92 · global profile saved');
  expect(await page.evaluate(()=>window.savedProfile.username)).toBe('Shrimp92');
  expect(await page.locator('#usernameInput').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
});
