const { test, expect } = require('@playwright/test');

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('arcadeOnboardingSeen', '1'));
});

test('daily challenges show three goals and award each XP reward only once', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#dailyMissionsSection')).toContainText('Daily Challenges');
  await expect(page.locator('#dailyMissionList .daily-mission-row')).toHaveCount(3);
  const rewards = await page.evaluate(() => {
    Arcade.dailyMissionStatus();
    localStorage.setItem('arcadeDailyGames', '3');
    localStorage.setItem('arcadeDailyGamesList', JSON.stringify(['snake', 'brickBreaker']));
    localStorage.setItem('arcadeCoinsEarnedToday', '15');
    const ready = Arcade.dailyMissionStatus().missions;
    const first = ready.map(m => Boolean(Arcade.claimDailyMission(m.id, {silent:true})));
    const second = ready.map(m => Boolean(Arcade.claimDailyMission(m.id, {silent:true})));
    return { first, second, claimed:Arcade.dailyMissionStatus().claimed };
  });
  expect(rewards).toEqual({first:[true,true,true],second:[false,false,false],claimed:3});
});

for (const scenario of [
  {game:'snake', key:'snakeBest', best:10, score:9, text:'Just 1 apple to match your best'},
  {game:'memory', key:'memoryBestMoves', best:12, score:15, text:'Use 3 moves fewer to match your best'},
  {game:'snake', key:'snakeBest', best:10, score:10, text:'You matched your best'},
  {game:'snake', key:'snakeBest', best:11, score:11, newBest:true, text:'Personal best set'}
]) {
  test('results target: ' + scenario.text, async ({page}) => {
    await page.goto('/index.html');
    await page.evaluate(s => {
      window.EarnlyCloud = { leaderboard:async () => ({entries:[]}) };
      localStorage.setItem(s.key, String(s.best));
      Arcade.gameResult({game:s.game, score:s.score, best:String(s.best), result:{newBest:s.newBest}, onReplay:() => {window.replayed = true;}});
    }, scenario);
    const dialog = page.locator('dialog.game-result-dialog');
    await expect(dialog.locator('.result-best-target')).toContainText(scenario.text);
    await dialog.locator('.result-actions button').first().click();
    await expect(dialog).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => window.replayed)).toBe(true);
  });
}

test('cloud best corrects a premature local record celebration', async ({page}) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.setItem('snakeBest', '10');
    localStorage.setItem('arcadeUsername', 'testplayer');
    window.EarnlyCloud = {
      submitLeaderboardScore:async () => {},
      leaderboard:async () => ({entries:[{username:'testplayer',score:20,rank:1}],label:'apples'})
    };
    Arcade.gameResult({game:'snake',score:10,best:'10 apples',result:{newBest:true}});
  });
  await expect(page.locator('.result-best-target')).toContainText('10 apples to match your best');
  await expect(page.locator('.result-badge')).not.toContainText('NEW BEST');
});


test('results connect earned coins to the furniture catalog without spending them', async ({page}) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    window.EarnlyCloud = { leaderboard:async () => ({entries:[]}) };
    localStorage.setItem('arcadeCoins', '25');
    Arcade.gameResult({game:'snake', score:10, coins:2, onReplay:() => {}});
  });
  const link = page.locator('.result-room-link');
  await expect(link).toContainText('Play to earn coins. Decorate your room.');
  await expect(link).toHaveAttribute('href', 'world.html?catalog=All');
  const before = await page.evaluate(() => localStorage.getItem('arcadeCoins'));
  await link.click();
  await expect(page).toHaveURL(/world\.html\?catalog=All/);
  await expect(page.locator('#worldPanel')).toBeVisible();
  await expect(page.locator('#worldPanel')).toContainText('Decor Catalog');
  expect(await page.evaluate(() => localStorage.getItem('arcadeCoins'))).toBe(before);
});

for (const width of [320, 390, 440]) {
  test('Spiral results keep replay above optional details at '+width, async ({page}) => {
    await page.setViewportSize({width,height:740});
    await page.goto('/mini.html?game=spiralDrop');
    await page.evaluate(() => {
      window.EarnlyCloud={leaderboard:async()=>({entries:[]})};
      Arcade.gameResult({game:'spiralDrop',title:'Spiral Drop',scoreLabel:'Rows',score:19,best:'97 rows',coins:12,result:{xpAward:35},extra:['Level reached: 4','Stage: Fast Fall'],onReplay:()=>window.spiralReplayed=true});
    });
    const dialog=page.locator('.spiral-result');
    await expect(dialog.locator('.result-main')).toContainText('19');
    await expect(dialog.locator('.result-stats')).toContainText('+12');
    await expect(dialog.locator('.result-notes')).not.toBeVisible();
    await expect(dialog.locator('.result-leaderboard')).not.toBeVisible();
    await expect(dialog.locator('.result-room-link')).not.toBeVisible();
    const play=dialog.locator('.result-actions button').first();
    const bounds=await play.boundingBox();
    expect(bounds.y+bounds.height).toBeLessThan(740);
    await dialog.getByText('Run details',{exact:true}).click();
    await expect(dialog.locator('.result-notes')).toContainText('Stage: Fast Fall');
    await expect(dialog.locator('.result-level-progress')).toBeVisible();
    await play.click();
    await expect.poll(()=>page.evaluate(()=>window.spiralReplayed)).toBe(true);
  });
}
