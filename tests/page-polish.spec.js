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

  expect(settings).toContain('id="ownerToolsCard"');
  expect(settings).toContain('hidden>');
  expect(settings).toContain('refreshTesterAccess()');
  expect(settings).toContain('Replay App Walkthrough');
  expect(settings).toContain('Help & Account Data');
  expect(settings).toContain('Backup & Restore');
  expect(settings).not.toContain('<span>Sync Queue</span>');
  expect(settings).not.toContain('🧪 Testing Tools');

  expect(stats).toContain('id="differentGames">0/23');

  expect(leaderboards).toContain('Signed-in players with a leaderboard username can compete globally');

  expect(support).toContain('Some game features can spend Coins');
  expect(support).toContain('signing in is also required for your public leaderboard identity');

  expect(privacy).toContain('account-signup stages');
  expect(privacy).toContain('does not include your account email address or password');

  expect(terms).toContain('Some game features may use Arcade Coins');
});

test('owner diagnostics stay out of the ordinary settings flow', async ({ page }) => {
  await page.goto('/settings.html');
  await expect(page.locator('#ownerToolsCard')).toBeHidden();
  await expect(page.getByText('Sync Queue')).toHaveCount(0);
  await expect(page.getByText('Testing Tools')).toHaveCount(0);
  await expect(page.getByText('Reset Test Plays')).toHaveCount(0);
  await expect(page.getByText('Copy Test Report')).toHaveCount(0);
  await expect(page.locator('.app-status-card')).toHaveCount(3);
  await expect(page.locator('.settings-menu-row')).toHaveCount(3);
  await expect(page.getByText('Replay App Walkthrough')).toBeVisible();
  await expect(page.getByText('Backup & Restore', { exact:true })).toBeVisible();
});

test('web and packaged iOS copies carry the audited player-facing wording', async ({ page }) => {
  const pairs = [
    ['rewards.html', 'Some in-game features can spend Coins'],
    ['settings.html', 'id="ownerToolsCard"'],
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

require('./settings-polish.cases');

require("./public-info.cases");
