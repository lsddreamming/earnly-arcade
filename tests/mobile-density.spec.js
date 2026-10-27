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

test('Home starts with play and compact destinations; progress stays available on demand',async({page})=>{
 await page.route('https://**',r=>r.abort());await page.setViewportSize({width:390,height:844});await page.goto('/index.html');
 await expect(page.locator('.home-primary-play')).toBeInViewport();await expect(page.locator('.home-world-link')).toBeInViewport();
 await expect(page.locator('#home-coin-shop')).toBeInViewport();await expect(page.locator('dialog[open]')).toHaveCount(0);
 await expect(page.locator('#challengeButton')).not.toBeVisible();await page.locator('#dailyMissionsSection > summary').click();await expect(page.locator('#challengeButton')).toBeVisible();
 await page.locator('#dailyMissionsSection > summary').click();await page.locator('.home-more-progress > summary').click();await expect(page.locator('#streakRewardCard')).toBeVisible();
 await page.locator('.home-more-progress > summary').click();await page.screenshot({path:test.info().outputPath('home-iphone.png'),fullPage:true});
 await page.setViewportSize({width:320,height:844});
 const overflow=await page.locator('body *').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().right>innerWidth+1&&n.getBoundingClientRect().width>0).map(n=>({tag:n.tagName,cls:n.className,width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right})));
 expect(overflow).toEqual([]);
});

for(const prefix of ['', 'www/']){
 for(const name of ['rewards','stats']){
  test('Progress hub '+prefix+name+' keeps mobile actions compact and chat in an opaque header',async({page})=>{
   await page.route('https://**',r=>r.abort());
   await page.route('**/cloud.js',r=>r.fulfill({contentType:'text/javascript',body:'window.EarnlyCloud={ready:true,session:async()=>null};window.dispatchEvent(new Event("earnly-cloud-ready"));'}));
   await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('points','2232');localStorage.setItem('arcadeSound','off');});
   await page.setViewportSize({width:390,height:844});await page.goto('/'+prefix+name+'.html');
   const header=page.locator(name==='rewards'?'.rewards-topbar':'.missions-container>.topbar');
   await expect(header.locator('#arcadeChatButton')).toBeVisible();
   for(const width of [320,390,440]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    expect(await header.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(11, 32, 53)');
    expect((await header.boundingBox()).height).toBeLessThan(85);
    const navRows=await page.locator('.bottom-nav-item').evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().top)));
    expect(new Set(navRows).size).toBe(1);
    if(name==='stats'){
     await expect(page.locator('.mission-card')).toHaveCount(4);
     for(const card of await page.locator('.mission-card').all())expect((await card.boundingBox()).height).toBeLessThan(150);
     await expect(page.locator('#streakDetails')).not.toHaveAttribute('open','');
    }else{
     await expect(page.locator('.rewards-wallet-actions a')).toHaveCount(3);
     await expect(page.getByRole('link',{name:'Style your avatar →',exact:true})).toBeInViewport();
     await expect(page.locator('.rewards-footnote')).not.toHaveAttribute('open','');
     expect((await page.locator('.rewards-footnote>summary').boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
   }
   await page.evaluate(()=>scrollTo(0,500));
   expect((await header.boundingBox()).y).toBeGreaterThanOrEqual(0);
   await header.locator('#arcadeChatButton').click();await expect(page.locator('#arcadeChat')).toBeVisible();
   await page.getByRole('button',{name:'Close chat',exact:true}).click();
   expect(await page.evaluate(()=>Arcade.number('points'))).toBe(2232);
   await page.evaluate(()=>scrollTo(0,0));await page.setViewportSize({width:390,height:844});
   await page.screenshot({path:test.info().outputPath(name+'-compact.png'),fullPage:true});
  });
 }
 test('Progress hub '+prefix+' preserves earnings expansion and weekly claim behavior',async({page})=>{
  await page.route('https://**',r=>r.abort());await page.route('**/cloud.js',r=>r.fulfill({contentType:'text/javascript',body:'window.EarnlyCloud={session:async()=>null};'}));
  await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');});
  await page.goto('/'+prefix+'rewards.html');
  await page.evaluate(()=>{for(let i=0;i<6;i++)Arcade.earn(2,'Fixture reward '+i,{kind:'test'});});
  await expect(page.locator('#history .history-item')).toHaveCount(3);await page.locator('#historyToggle').click();
  await expect(page.locator('#history .history-item')).toHaveCount(6);await page.locator('#historyToggle').click();await expect(page.locator('#history .history-item')).toHaveCount(3);
  await page.locator('.rewards-footnote>summary').click();await expect(page.locator('.rewards-footnote')).toContainText('Purchased coins are never redeemable');
  const balance=await page.evaluate(()=>Arcade.number('points'));
  await page.goto('/'+prefix+'stats.html');
  await page.evaluate(()=>{Arcade.weeklyStatus();localStorage.setItem('weeklyGamesCompleted','10');window.dispatchEvent(new Event('earnly-data-change'));});
  const mission=await page.evaluate(()=>Arcade.weeklyStatus().missions.find(m=>m.type==='games'));
  const xp=await page.evaluate(()=>Arcade.xpStatus().xp);
  await page.getByRole('button',{name:'Claim +'+mission.rewardXP+' XP',exact:true}).click();
  await expect(page.locator('.mission-card').filter({hasText:mission.title})).toContainText('Claimed ✓');
  expect(await page.evaluate(()=>Arcade.xpStatus().xp)).toBe(xp+mission.rewardXP);
  expect(await page.evaluate(()=>Arcade.number('points'))).toBe(balance);
  expect(await page.evaluate(id=>Arcade.claimWeeklyMission(id),mission.id)).toBe(false);
  await page.locator('#streakDetails>summary').click();await expect(page.locator('#streakRewardList')).toBeVisible();
  await page.locator('.mission-play-button').first().click();await expect(page).not.toHaveURL(/stats.html$/);
 });
}

test('Header coin balances consistently lead to coin packs without replacing the balance value',async({page})=>{
 await page.route('https://**',r=>r.abort());
 for(const prefix of ['', 'www/'])for(const name of ['profile.html','games.html','stats.html','turbo-kart.html','neondrift.html','avatars.html']){
  await page.goto('/'+prefix+name);
  const chip=page.locator(name==='avatars.html'?'.coin-chip':'.balance-chip').filter({has:page.locator(name==='avatars.html'?'#coin-balance':'#balance')});
  await expect(chip).toHaveAttribute('href',name==='avatars.html'?'#coin-shop':'avatars.html#coin-shop');
  expect(await chip.evaluate(el=>el.tagName)).toBe('A');
 }
});

for (const width of [320, 390, 440]) {
  for (const prefix of ['', 'www/']) {
    test(`catalog badges and Snake reward copy: ${prefix || 'root/'} ${width}px`, async ({ page, baseURL }, testInfo) => {
      await page.setViewportSize({ width, height: 956 });
      await page.goto(new URL('/' + prefix + 'games.html', process.env.EARNLY_CATALOG_BASE_URL || baseURL).href);
      // Wait for the catalog's dynamic rebuild, including its favorite controls.
      await expect(page.getByRole('button', { name: 'Add Snake favorite', exact: true })).toBeVisible();
      await expect(page.locator('[data-game="snake"] .reward-rule')).toHaveText('Grow the snake · up to 100 Arcade Coins per run');
      for (const game of ['crystalCommand', 'bubblePop', 'neonSlice']) {
        const card = page.locator('#games > [data-game="' + game + '"]');
        await card.scrollIntoViewIfNeeded();
        const geometry = await card.evaluate(el => {
          const box = node => { const r = node.getBoundingClientRect(); return {left:r.left, right:r.right, top:r.top, bottom:r.bottom}; };
          return {card:box(el), badge:box(el.querySelector('.game-new-bubble')), controls:[...el.querySelectorAll('h2, .favorite-button, .game-play-button')].map(box)};
        });
        const {card:bounds, badge, controls} = geometry;
        expect(badge.left).toBeGreaterThanOrEqual(bounds.left);
        expect(badge.right).toBeLessThanOrEqual(bounds.right);
        expect(badge.top).toBeGreaterThanOrEqual(bounds.top);
        expect(badge.bottom).toBeLessThanOrEqual(bounds.bottom);
        for (const control of controls) {
          const overlaps = badge.left < control.right && badge.right > control.left && badge.top < control.bottom && badge.bottom > control.top;
          expect(overlaps, game + ' badge overlaps title or control').toBe(false);
        }
      }
      await page.screenshot({ path: testInfo.outputPath('catalog.png'), fullPage: true });
    });
  }
}
