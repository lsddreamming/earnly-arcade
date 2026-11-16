const {test,expect}=require('@playwright/test');
for(const prefix of ['/', '/www/']){
 test(prefix+'BIG FISH ENERGY has original cover, bottom catalog link and playable phone route',async({page,baseURL})=>{
  await page.setViewportSize({width:390,height:844});
  // Live publication checks never authenticate, write wallets or submit scores.
  await page.route('**/functions/v1/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"QA_OFFLINE"}'}));
  await page.route('**/rest/v1/**',route=>route.abort());
  await page.route('**/auth/v1/**',route=>route.abort());
  await page.goto(new URL(prefix+'games.html',process.env.EARNLY_CATALOG_BASE_URL||baseURL).href);
  await page.locator('[data-filter=all]').click();
  const card=page.locator('#games .catalog-tile').last();
  await expect(card).toHaveAttribute('data-game','bigFishEnergy');
  await expect(card.locator('.game-play-button')).toHaveText('Play');
  await expect(card.locator('.game-play-button')).toHaveAttribute('href','big-fish-energy.html');
  await page.evaluate(()=>{const key='earnly.games.starter.queue.v1',saved=JSON.parse(localStorage.getItem(key));saved.remaining=['bigFishEnergy',...saved.signature.split('|').filter(id=>id!=='bigFishEnergy')];saved.previous=[];localStorage.setItem(key,JSON.stringify(saved));});
  await page.reload();
  const featured=page.locator('#games [data-game=bigFishEnergy]');
  const cover=featured.locator('.game-preview-photo');
  await expect(cover).toHaveAttribute('src','game-preview-big-fish-energy.webp');
  await expect.poll(()=>cover.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await featured.locator('.game-play-button').click();
  await expect(page).toHaveTitle('BIG FISH ENERGY · Earnly Arcade');
  await expect(page.locator('#start')).toBeInViewport();
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#pause')).toBeInViewport();
  await expect(page.locator('#boost')).toBeInViewport();
  await page.locator('#pause').click();
  await expect(page.locator('#pauseSheet')).toBeVisible();
  await page.locator('#resume').click();
  await expect(page.locator('#pauseSheet')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 });
}
