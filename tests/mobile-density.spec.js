const { test, expect } = require('@playwright/test');

const auditPages = [
  ['index.html', '.home-primary-play', 190],
  ['games.html', '.game-browser-tools', 300],
  ['rewards.html', '.rewards-balance-card', 240],
  ['profile.html', '.profile-key-stats', 320],
  ['account.html', '.cloud-account-card', 270],
  ['settings.html', '.card', 270],
  ['stats.html', '.missions-weekly-card', 330],
  ['leaderboards.html', '.leaderboard-toolbar', 300],
  ['support.html', '.card', 280],
  ['privacy.html', '.legal-card', 280],
  ['terms.html', '.legal-card', 280]
];

for (const width of [320, 390, 440]) {
  for (const [path, selector, maxTop] of auditPages) {
    test(`mobile density: ${path} ${width}px keeps primary content high and avoids horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/' + path);

      const metrics = await page.evaluate((targetSelector) => {
        const target = document.querySelector(targetSelector);
        const h1 = document.querySelector('h1');
        return {
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          targetTop: target ? target.getBoundingClientRect().top : null,
          h1Bottom: h1 ? h1.getBoundingClientRect().bottom : null
        };
      }, selector);

      expect(metrics.scrollWidth, path + ' horizontal overflow').toBeLessThanOrEqual(metrics.innerWidth + 1);
      expect(metrics.targetTop, path + ' primary target missing').not.toBeNull();
      expect(metrics.targetTop, path + ' primary content too low').toBeLessThan(maxTop);
      expect(metrics.h1Bottom, path + ' heading too low').toBeLessThan(230);
    });
  }
}

test('mobile density styles stay scoped away from active game controls', async ({ page }) => {
  const css = await (await page.request.get('/premium.css')).text();
  expect(css).toContain('Mobile density pass');
  expect(css).toContain('body.account-dashboard .page-header');
  expect(css).toContain('body.leaderboards-dashboard .leaderboard-hero');
  expect(css).not.toContain('body.snake-page .page-header');
  expect(css).not.toContain('body.blockdrop-page .page-header');
  expect(css).not.toContain('body.brick-breaker-page .page-header');
});
