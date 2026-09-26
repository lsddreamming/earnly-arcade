const { test, expect } = require('@playwright/test');

// Loaded by smoke.spec.js so both existing CI browser projects run these checks.
const entrySizes = [
  { width:320, height:740 },
  { width:390, height:844 },
  { width:440, height:956 }
];

async function mockEntryLeaderboard(page) {
  // Local test fixtures only: never submit scores or use live player accounts.
  await page.route('**/cloud.js', route => route.fulfill({ contentType:'application/javascript', body:'' }));
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType:'application/javascript', body:'' }));
  await page.addInitScript(() => {
    localStorage.setItem('arcadeOnboardingSeen','1');
    window.EarnlyCloud = {
      leaderboard:async game => ({
        entries:[
          {rank:1,username:'LongPlayerName123',avatar:'🚀',score:108},
          {rank:2,username:'McGogh',avatar:'🧠',score:92},
          {rank:3,username:'Elmerglue',avatar:'🎮',score:14}
        ],
        label:game === 'neonMaze' ? 'cells' : 'lines',
        lowerIsBetter:false
      }),
      submitLeaderboardScore:async () => ({ok:true})
    };
  });
}

for (const file of ['blockdrop.html','neonmaze.html']) {
  for (const size of entrySizes) {
    test(`compact entry: ${file} ${size.width}px keeps the board and a single start action visible`, async ({page}, testInfo) => {
      await page.setViewportSize(size);
      await mockEntryLeaderboard(page);
      await page.goto('/'+file);
      const start = page.locator(file === 'blockdrop.html' ? '#blockDropBoardStart' : '#startButton');
      const leaders = page.locator('#earnlyCompactLeaderboard');
      await expect(leaders.locator('.compact-leaderboard-row')).toHaveCount(3);
      await expect(start).toBeVisible();
      await expect(start).toBeInViewport();
      await expect(page.locator('.game-start-summary')).toBeHidden();
      await expect(page.locator('.game-guide-strip')).toBeHidden();
      await expect(page.locator('.game-guide-overlay')).toBeHidden();
      await expect(page.locator('.topbar a[href="games.html"]')).toBeVisible();
      await expect(page.locator('.game-guide-more summary')).toBeVisible();
      if (file === 'blockdrop.html') await expect(page.locator('#startButton')).toBeHidden();

      const layout = await page.evaluate(() => {
        const box = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
        };
        return {
          board:box('#game'),
          leaderboard:box('#earnlyCompactLeaderboard'),
          stats:box('.game-meta'),
          rows:[...document.querySelectorAll('.compact-leaderboard-row')].map(el => el.getBoundingClientRect().y),
          overflow:document.documentElement.scrollWidth-innerWidth,
          filter:getComputedStyle(document.querySelector('#game')).filter,
          playerFont:parseFloat(getComputedStyle(document.querySelector('.compact-leaderboard-player')).fontSize)
        };
      });
      console.log('ENTRY_GEOMETRY', file, size.width, JSON.stringify(layout));
      expect(layout.leaderboard.height).toBeLessThan(145);
      expect(Math.max(...layout.rows)-Math.min(...layout.rows)).toBeLessThan(3);
      expect(layout.stats.height).toBeLessThan(55);
      expect(layout.board.y).toBeLessThan(360);
      expect(layout.board.width).toBeGreaterThan(145);
      expect(layout.board.x).toBeGreaterThanOrEqual(0);
      expect(layout.board.right).toBeLessThanOrEqual(size.width+1);
      expect(layout.overflow).toBeLessThanOrEqual(1);
      expect(layout.filter).toBe('none');
      expect(layout.playerFont).toBeGreaterThanOrEqual(12);
      const ratio = file === 'blockdrop.html' ? 2 : 390/330;
      expect(Math.abs(layout.board.height/layout.board.width-ratio)).toBeLessThan(.035);
      await testInfo.attach(`${file}-${size.width}-ready`, {body:await page.screenshot(),contentType:'image/png'});

      if (testInfo.project.use.hasTouch) await start.tap();
      else await start.click();
      await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:6000});
      const pause = page.locator('#earnlyPauseButton');
      await expect(pause).toBeVisible();
      await expect(pause).toBeInViewport();
      if (testInfo.project.use.hasTouch) await pause.tap();
      else await pause.click();
      await expect(page.locator('#gameStatus')).toHaveText('Paused');
      if (testInfo.project.use.hasTouch) await pause.tap();
      else await pause.click();
      await expect(page.locator('#gameStatus')).toHaveText('Running');
      if (file === 'blockdrop.html') {
        await expect(page.locator('#blockDropExit')).toBeInViewport();
        await expect(page.locator('#nextPiece')).toBeVisible();
        await expect(page.locator('#thenPiece')).toBeVisible();
        if (testInfo.project.use.hasTouch) await page.locator('#blockDropExit').tap();
        else await page.locator('#blockDropExit').click();
        await expect(page).toHaveURL(/games\.html/);
      }
    });
  }
}

test('compact entry: web and packaged iOS layout assets stay identical and cached', async ({page}) => {
  for (const file of ['blockdrop.html','neonmaze.html','compact-game-entry.css']) {
    const web = await page.request.get('/'+file);
    const native = await page.request.get('/www/'+file);
    expect(web.ok()).toBeTruthy();
    expect(native.ok()).toBeTruthy();
    expect(await native.text()).toBe(await web.text());
  }
  const worker = await (await page.request.get('/service-worker.js')).text();
  expect(worker).toContain("'./compact-game-entry.css'");
});
