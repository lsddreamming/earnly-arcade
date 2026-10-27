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
  await page.getByText('Use your coins', {exact:true}).click();
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
    await expect(dialog.locator('.result-stat').nth(0).locator('strong')).toHaveText('+12');
    await expect(dialog.locator('.result-stat').nth(1).locator('strong')).toHaveText('+35');
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

for (const game of ['snake', 'memory', 'tapRush', 'neonBreach', 'neonDrift', 'brickBreaker']) {
  test(game + ' uses compact results with working optional actions', async ({page}) => {
    await page.setViewportSize({width:320,height:568});
    await page.goto('/index.html');
    await page.evaluate(game => {
      window.EarnlyCloud = {leaderboard:async()=>({entries:[]})};
      window.EarnlyPaidPlays = {remaining:()=>0,buy:async()=>{window.boughtPlays=true;}};
      Arcade.gameResult({game,title:'A completed arcade adventure',score:19,coins:12,
        result:{xpAward:35},extra:['Run detail preserved'],onReplay:()=>window.compactReplayed=true});
    },game);
    const dialog=page.locator('.compact-result');
    await expect(dialog.locator('.result-main > strong')).toContainText('19');
    await expect(dialog.locator('.result-stat').nth(0).locator('strong')).toHaveText('+12');
    await expect(dialog.locator('.result-stat').nth(1).locator('strong')).toHaveText('+35');
    await expect(dialog.locator('.result-notes')).toBeHidden();
    await expect(dialog.locator('.result-level-progress')).toBeHidden();
    await expect(dialog.locator('.result-leaderboard')).toBeHidden();
    await expect(dialog.locator('.result-room-link')).toBeHidden();
    const play=dialog.getByRole('button',{name:/Play Again/});
    const bounds=await play.boundingBox();
    expect(bounds.y+bounds.height).toBeLessThanOrEqual(568);
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await dialog.getByText('Run details',{exact:true}).click();
    await expect(dialog.locator('.result-notes')).toBeVisible();
    await expect(dialog.locator('.result-notes')).toContainText('Run detail preserved');
    await expect(dialog.locator('.result-level-progress')).toBeVisible();
    await dialog.getByText('Use your coins',{exact:true}).click();
    await expect(dialog.locator('.result-room-link')).toBeVisible();
    await dialog.getByRole('button',{name:'3 extra plays · 25 coins'}).click();
    await expect.poll(()=>page.evaluate(()=>window.boughtPlays)).toBe(true);
    await play.click();
    await expect.poll(()=>page.evaluate(()=>window.compactReplayed)).toBe(true);
  });
}

for (const surface of ['result', 'gate', 'used-demo-unlocks']) {
  test('website empty-play ' + surface + ' offers unlimited free play without changing rewards', async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await page.goto('/snake.html');
    const before = await page.evaluate(surface => {
      window.EarnlyNativeAds = {isNative:false};
      window.EarnlyWebAds = {enabled:false};
      Arcade.remaining('snake');
      localStorage.setItem('snakeGamesPlayed','3');
      localStorage.setItem('snakeBonusPlays','0');
      localStorage.setItem('snakePlayAdUnlocks',surface==='used-demo-unlocks'?'2':'0');
      const snapshot = {coins:Arcade.number('points'),plays:Arcade.remaining('snake'),unlocks:Arcade.playAdStatus('snake').used};
      if(surface==='result') Arcade.gameResult({game:'snake',score:0,coins:0,onReplay:()=>{window.unexpectedReplay=true;}});
      else Arcade.out('snake');
      return snapshot;
    },surface);
    const button=page.getByRole('button',{name:'▶ Neon Slice · Unlimited free play',exact:true});
    await expect(button).toBeVisible();
    const box=await button.boundingBox();
    expect(box.y+box.height).toBeLessThanOrEqual(844);
    if(surface!=='used-demo-unlocks') await expect(page.locator('dialog')).toContainText('Website video ads aren’t available yet');
    expect(await page.evaluate(()=>({coins:Arcade.number('points'),plays:Arcade.remaining('snake'),unlocks:Arcade.playAdStatus('snake').used}))).toEqual(before);
    await button.click();
    await expect(page).toHaveURL(/neon-slice\.html$/);
    expect(await page.evaluate(()=>({coins:Arcade.number('points'),plays:Arcade.remaining('snake'),unlocks:Arcade.playAdStatus('snake').used}))).toEqual(before);
  });
}

test('native empty-play result keeps the real rewarded replay first', async ({page}) => {
  await page.goto('/snake.html');
  await page.evaluate(()=>{
    Arcade.remaining('snake');
    localStorage.setItem('snakeGamesPlayed','3');
    window.EarnlyNativeAds={isNative:true,showRewarded:async()=>({earned:true})};
    Arcade.gameResult({game:'snake',score:0,coins:0,onReplay:()=>{}});
  });
  await expect(page.locator('.result-actions button').first()).toHaveText('📺 Watch Ad · +1 Play & Replay');
  await expect(page.locator('.result-free-game')).toHaveCount(0);
});

for (const reason of ['🧱 Hit the wall','🐍 Hit your tail']) {
  test('Snake result explains '+reason+' before rewards',async({page})=>{
    await page.setViewportSize({width:320,height:568});
    await page.goto('/snake.html');
    await page.evaluate(reason=>{gameOver(reason,true);},reason);
    const dialog=page.locator('dialog.game-result-dialog');
    await expect(dialog.locator('.result-outcome')).toHaveText(reason.includes('wall')?'You hit the wall.':'You hit your tail.');
    await expect(dialog.locator('.result-tip')).toContainText('Tip:');
    const play=dialog.getByRole('button',{name:/Play Again/});
    const bounds=await play.boundingBox();
    expect(bounds.y+bounds.height).toBeLessThan(568);
    const order=await dialog.evaluate(el=>Boolean(el.querySelector('.result-actions').compareDocumentPosition(el.querySelector('.result-stats')) & Node.DOCUMENT_POSITION_FOLLOWING));
    expect(order).toBe(true);
  });
}

test('Neon Breach shows defeated robots and one tip beside the score',async({page})=>{
  await page.goto('/neonbreach.html');
  await page.evaluate(()=>{
    Arcade.countdown=fn=>fn();
    NeonBreachEngine.tick=state=>{state.kills=1;state.score=100;state.ended=true;};
  });
  await page.locator('#startButton').click();
  await expect(page.locator('.result-outcome')).toHaveText('1 robot defeated');
  await expect(page.locator('.result-tip')).toHaveText('Tip: keep moving sideways while you fire.');
  await expect(page.getByRole('button',{name:/Play Again/})).toBeVisible();
});
