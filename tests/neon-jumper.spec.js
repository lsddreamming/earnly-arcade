import { test, expect } from '@playwright/test';
test('Neon Jumper preview starts, pauses, resumes, and restarts', async ({ page }) => {
 await page.goto('/neon-jumper.html');
 await expect(page.getByText('UNLISTED · FREE PREVIEW')).toBeVisible();
 await expect(page.getByText('No Arcade Coins awarded')).toBeVisible();
 await page.getByRole('button',{name:'Play free'}).click();
 await expect(page.getByRole('button',{name:'Pause'})).toBeEnabled();
 await expect(page.locator('#overlay')).toBeHidden();
 await page.waitForTimeout(350);
 await page.getByRole('button',{name:'Pause'}).click();
 await expect(page.getByRole('heading',{name:'Paused'})).toBeVisible();
 await page.getByRole('button',{name:'Resume →'}).click();
 await expect(page.locator('#overlay')).toBeHidden();
 await page.getByRole('button',{name:'Restart'}).click();
 await expect(page.locator('#height')).toHaveText('0');
});
test('Neon Jumper has identical root and www previews', async ({request}) => {
 const a=await request.get('/neon-jumper.html');
 const b=await request.get('/www/neon-jumper.html');
 expect(a.ok()).toBeTruthy();expect(b.ok()).toBeTruthy();
 expect(await a.text()).toBe(await b.text());
});