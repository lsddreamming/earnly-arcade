const { test, expect } = require('@playwright/test');

test('Snake leaderboard visibility settles without rewriting its own class', async ({ page }) => {
  await page.goto('/snake.html');
  const mutations = await page.evaluate(async () => {
    const card = document.querySelector('#earnlyCompactLeaderboard');
    if (!card) throw new Error('Snake leaderboard did not mount');
    let changes = 0;
    const observer = new MutationObserver(records => { changes += records.length; });
    observer.observe(card, { attributes:true, attributeFilter:['class'] });
    document.body.classList.add('game-active');
    await new Promise(resolve => setTimeout(resolve, 100));
    const active = card.classList.contains('during-game-compact');
    document.body.classList.remove('game-active');
    await new Promise(resolve => setTimeout(resolve, 100));
    observer.disconnect();
    return { changes, active, settled:!card.classList.contains('during-game-compact') };
  });
  expect(mutations).toEqual({ changes:2, active:true, settled:true });
});

test('compact leaderboard refresh does not submit the saved best again', async ({ page }) => {
  await page.goto('/snake.html');
  const counts = await page.evaluate(async () => {
    let submits = 0;
    let lists = 0;
    window.EarnlyCloud = {
      submitLeaderboardScore: async () => {
        submits += 1;
        window.dispatchEvent(new CustomEvent('earnly-leaderboard-updated'));
        return { saved:true };
      },
      leaderboard: async () => {
        lists += 1;
        return { label:'points', entries:[{ rank:1, username:'qa_player', score:42 }] };
      }
    };
    window.dispatchEvent(new CustomEvent('earnly-leaderboard-updated'));
    await new Promise(resolve => setTimeout(resolve, 100));
    return { submits, lists, text:document.querySelector('#earnlyCompactLeaderboard')?.textContent };
  });
  expect(counts.submits).toBe(0);
  expect(counts.lists).toBeGreaterThanOrEqual(1);
  expect(counts.text).toContain('@qa_player');
});

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
  expect(web).toContain('localLeaderboardSubmitDepth');
  expect(web).toContain('refreshBoardWithoutResubmit');
  expect(web).not.toContain("window.addEventListener('earnly-leaderboard-updated', loadBoard)");
});

test('results show authoritative rank and username instead of a stale local identity',async({page})=>{
 await page.goto('/turbo-kart.html');await page.evaluate(()=>{
 localStorage.setItem('arcadeUsername','old_name');Arcade.recordResult('turboKart',3250);
 window.EarnlyCloud={submitLeaderboardScore:async()=>({ok:true,rank:1,username:'current_player',score:3250}),leaderboard:async()=>({entries:[{rank:1,username:'current_player',score:3250}]})};
 Arcade.gameResult({game:'turboKart',score:3250,coins:17});});
 await expect(page.locator('.result-leaderboard-head')).toContainText('You: #1');await expect(page.locator('.result-leaderboard')).toContainText('@current_player');
});
test('failed score submission is visible and retry confirms rank without another reward',async({page})=>{
 await page.goto('/turbo-kart.html');await page.evaluate(()=>{
 localStorage.setItem('arcadeUsername','qa_player');Arcade.recordResult('turboKart',3250);window.rankCalls=0;
 window.EarnlyCloud={submitLeaderboardScore:async()=>{if(++window.rankCalls===1)throw Error('offline');return {ok:true,rank:1,username:'qa_player'};},leaderboard:async()=>({entries:[{rank:1,username:'rival',score:2250}]})};
 Arcade.gameResult({game:'turboKart',score:3250,coins:17});});
 await expect(page.locator('.result-leaderboard')).toContainText('Score sync pending');await expect(page.locator('.result-leaderboard')).not.toContainText('outside Top 25');
 await page.locator('.result-run-details').first().locator('summary').click();
 const before=await page.evaluate(()=>Arcade.number('points'));await page.getByRole('button',{name:'Retry score sync'}).click();await expect(page.locator('.result-leaderboard-head')).toContainText('You: #1');expect(await page.evaluate(()=>Arcade.number('points'))).toBe(before);
});
test('signed-out result asks for sign-in rather than inventing a world rank',async({page})=>{
 await page.goto('/turbo-kart.html');await page.evaluate(()=>{localStorage.setItem('arcadeUsername','qa_player');Arcade.recordResult('turboKart',3250);window.EarnlyCloud={submitLeaderboardScore:async()=>({skipped:'signed-out'}),leaderboard:async()=>({entries:[{rank:1,username:'rival',score:2250}]})};Arcade.gameResult({game:'turboKart',score:3250});});
 await page.locator('.result-run-details').first().locator('summary').click();
 await expect(page.locator('.result-leaderboard-head')).toContainText('Sign in to save your score');await expect(page.locator('.result-leaderboard').getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
});
