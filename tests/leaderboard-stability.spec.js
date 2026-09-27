const { test, expect } = require('@playwright/test');

test('leaderboard refresh events do not resubmit the local best or blank rendered rows', async ({ page }) => {
  await page.goto('/leaderboards.html');

  await page.evaluate(() => {
    window.__leaderboardQa = { submits:0, lists:0 };
    Arcade.best = () => ({ value:321 });
    Arcade.leaderboardUsername = () => 'qa_player';
    Arcade.profileIcon = () => '🎮';

    window.EarnlyCloud = {
      submitLeaderboardScore: async () => {
        window.__leaderboardQa.submits += 1;
        return { saved:true };
      },
      leaderboard: async () => {
        window.__leaderboardQa.lists += 1;
        return {
          label:'points',
          entries:[{ rank:1, username:'qa_player', avatar:'🎮', score:321, verified:true }]
        };
      },
      reportLeaderboardPlayer: async () => ({ ok:true })
    };
  });

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('earnly-leaderboard-updated', { detail:{ saved:true } }));
  });

  await expect(page.locator('#leaderboardList')).toContainText('@qa_player');
  await expect(page.locator('#leaderboardList')).not.toContainText('Loading world rankings');

  const counts = await page.evaluate(() => window.__leaderboardQa);
  expect(counts.submits).toBe(0);
  expect(counts.lists).toBeGreaterThanOrEqual(1);
});

test('leaderboard web and bundled iOS copies stay identical', async ({ page }) => {
  const web = await (await page.request.get('/leaderboards.html')).text();
  const ios = await (await page.request.get('/www/leaderboards.html')).text();
  expect(ios).toBe(web);
  expect(web).toContain('localLeaderboardSubmitInFlight');
  expect(web).toContain('refreshBoardWithoutResubmit');
  expect(web).not.toContain("window.addEventListener('earnly-leaderboard-updated', loadBoard)");
});
