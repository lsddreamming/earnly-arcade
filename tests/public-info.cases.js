const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('every public page has working static information links, including the web mirror', async ({ request }) => {
  const root = path.resolve(__dirname, '..');
  for (const prefix of ['', 'www/']) {
    const pages = fs.readdirSync(path.join(root, prefix)).filter(file => file.endsWith('.html'));
    for (const file of pages) {
      const html = await (await request.get('/' + prefix + file)).text();
      expect(html, prefix + file).toContain('aria-label="Site information"');
      const footer = html.match(/<footer class="public-footer"[\s\S]*?<\/footer>/)?.[0];
      expect(footer, prefix + file).toBeTruthy();
      for (const target of ['index.html', 'games.html', 'about.html', 'game-guides.html', 'support.html', 'privacy.html', 'terms.html']) {
        expect(footer, prefix + file).toContain('href="' + target + '"');
        expect(fs.existsSync(path.join(root, prefix, target)), prefix + target).toBeTruthy();
      }
      expect(html, prefix + file).toContain('href="public-info.css"');
    }
  }
});

test('all 23 guides have valid play destinations and meaningful controls and strategy', async ({ page }) => {
  await page.goto('/game-guides.html');
  const guides = page.locator('.game-reference');
  await expect(guides).toHaveCount(23);
  const links = await page.locator('.guide-index a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  for (const href of links) await expect(page.locator(href)).toHaveCount(1);
  for (const guide of await guides.all()) {
    await expect(guide).toContainText('Controls');
    await expect(guide).toContainText('Goal and challenge');
    await expect(guide).toContainText('A useful strategy');
    const href = await guide.locator('.guide-play .button').getAttribute('href');
    expect((await page.request.get('/' + href)).ok(), href).toBeTruthy();
  }
});

test('public pages remain navigable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled:false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/index.html');
  await page.locator('.public-footer').getByRole('link', { name:'About', exact:true }).click();
  await expect(page.getByRole('heading', { name:'About Earnly Arcade', exact:true })).toBeVisible();
  await page.locator('.public-footer').getByRole('link', { name:'Game Guides', exact:true }).click();
  await expect(page.locator('.game-reference')).toHaveCount(23);
  await context.close();
});

for (const width of [320, 440]) {
  test('public information at ' + width + 'px stays readable with accessible navigation', async ({ page }) => {
    await page.setViewportSize({ width, height:900 });
    await page.addInitScript(() => localStorage.setItem('arcadeOnboardingSeen', '1'));
    for (const route of ['about.html', 'game-guides.html', 'index.html', 'games.html', 'privacy.html']) {
      await page.goto('/' + route);
      const metrics = await page.evaluate(() => ({ viewport:innerWidth, content:document.documentElement.scrollWidth }));
      expect(metrics.content, route).toBeLessThanOrEqual(metrics.viewport + 1);
      const footer = page.locator('.public-footer');
      await footer.scrollIntoViewIfNeeded();
      await expect(footer.getByRole('link', { name:'Help & Contact', exact:true })).toBeVisible();
      const height = await footer.getByRole('link', { name:'Privacy', exact:true }).evaluate(node => node.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44);
    }
  });
}

test('online banner is absent from accessibility and updates for offline and reconnect', async ({ page, context }) => {
  await page.goto('/about.html');
  await expect(page.locator('#connectionBanner')).toBeHidden();
  await expect(page.locator('#connectionBanner')).toHaveText('');
  await context.setOffline(true);
  await expect(page.locator('#connectionBanner')).toBeVisible();
  await expect(page.locator('#connectionBanner')).toContainText('Offline mode');
  await context.setOffline(false);
  await expect(page.locator('#connectionBanner')).toBeHidden();
  await expect(page.locator('#connectionBanner')).toHaveText('');
});

test('shared mini-game guides link to the selected game', async ({ page }) => {
  await page.goto('/mini.html?game=mergeRush');
  await expect(page.locator('#miniPublicGuide')).toHaveAttribute('href', 'game-guides.html#mergeRush');
  await expect(page.locator('#miniPublicGuide')).toContainText('Merge Rush');
});

test('game information navigation asks before leaving an active run', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('arcadeOnboardingSeen', '1'));
  await page.goto('/snake.html');
  await page.locator('#startButton').click();
  await expect(page.locator('#gameStatus')).toHaveClass(/running/, { timeout:5000 });
  // Click through script to test the exit guard without scrolling a running game.
  await page.locator('.game-guide-link').evaluate(link => link.click());
  const dialog = page.getByRole('dialog', { name:'Quit this game?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name:'Keep Playing', exact:true }).click();
  await expect(page).toHaveURL(/snake\.html$/);
  await page.locator('.game-guide-link').evaluate(link => link.click());
  await dialog.getByRole('button', { name:'Quit Game', exact:true }).click();
  await expect(page).toHaveURL(/game-guides\.html#snake$/);
});
