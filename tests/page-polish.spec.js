const { test, expect } = require('@playwright/test');

test('player-facing pages match current Earnly behavior after full-page audit', async ({ page }) => {
  const [rewards, settings, stats, leaderboards, support, privacy, terms] = await Promise.all([
    page.request.get('/rewards.html').then(r => r.text()),
    page.request.get('/settings.html').then(r => r.text()),
    page.request.get('/stats.html').then(r => r.text()),
    page.request.get('/leaderboards.html').then(r => r.text()),
    page.request.get('/support.html').then(r => r.text()),
    page.request.get('/privacy.html').then(r => r.text()),
    page.request.get('/terms.html').then(r => r.text())
  ]);

  expect(rewards).toContain('Some in-game features can spend Coins');
  expect(rewards).not.toContain('cannot be cashed out, transferred, or spent in this version');
  expect(rewards).toContain('eligible in-game features such as Continue');

  expect(settings).toContain('id="testingToolsCard"');
  expect(settings).toContain('hidden>');
  expect(settings).toContain('refreshTesterAccess()');
  expect(settings).toContain('<span>Sync Queue</span>');

  expect(stats).toContain('id="differentGames">0/23');

  expect(leaderboards).toContain('Signed-in players with a leaderboard username can compete globally');

  expect(support).toContain('signing in is also required for your public leaderboard identity');
  expect(support).toContain('Some game features can spend Coins');

  expect(privacy).toContain('account-signup stages');
  expect(privacy).toContain('does not include your account email address or password');

  expect(terms).toContain('Some game features may use Arcade Coins');
});

test('internal testing tools stay hidden for an ordinary settings visit', async ({ page }) => {
  await page.goto('/settings.html');
  await expect(page.locator('#testingToolsCard')).toBeHidden();
  await expect(page.locator('#queueStatus')).toBeVisible();
});

test('web and packaged iOS copies carry the audited player-facing wording', async ({ page }) => {
  const pairs = [
    ['rewards.html', 'Some in-game features can spend Coins'],
    ['settings.html', 'id="testingToolsCard"'],
    ['stats.html', 'id="differentGames">0/23'],
    ['leaderboards.html', 'Signed-in players with a leaderboard username'],
    ['support.html', 'Some game features can spend Coins'],
    ['privacy.html', 'account-signup stages'],
    ['terms.html', 'Some game features may use Arcade Coins']
  ];

  for (const [path, marker] of pairs) {
    const web = await (await page.request.get('/' + path)).text();
    const ios = await (await page.request.get('/www/' + path)).text();
    expect(web, path + ' web copy').toContain(marker);
    expect(ios, path + ' iOS copy').toContain(marker);
  }
});
