const {test,expect}=require('@playwright/test');
const deep=['bubblePop','crystalCommand','neonBreach','spuddyTurf','harborGetaway','spuddyEvolution','bigFishEnergy'];
for(const prefix of ['/','/www/']){
 for(const [width,height] of [[320,568],[390,844],[1024,844]]){
  test(`games paths and search ${prefix} ${width}px`,async({page,baseURL})=>{
   await page.setViewportSize({width,height});
   await page.route('**/functions/v1/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"QA_OFFLINE"}'}));
   await page.route('**/rest/v1/**',route=>route.abort());
   await page.route('**/auth/v1/**',route=>route.abort());
   await page.goto(new URL(prefix+'games.html',baseURL).href);
   const quick=page.locator('[data-path="short-session"]'),big=page.locator('[data-path="deep-session"]');
   await expect(quick).toBeVisible();await expect(big).toBeVisible();
   await expect(page.locator('#games.starter-grid .catalog-tile')).toHaveCount(4);
   await page.screenshot({path:test.info().outputPath('games-discovery-'+width+'.png')});
   if(width<600){
    const play=page.locator('#games .catalog-tile').first().locator('.game-play-button');
    const bounds=await play.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.y+bounds.height).toBeLessThanOrEqual(height-64);
    const choices=await page.locator('#gamePlayPaths button').evaluateAll(buttons=>buttons.map(button=>{
     const rect=button.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,height:rect.height};
    }));
    expect(choices[0].top).toBe(choices[1].top);
    expect(choices.every(choice=>choice.height>=44&&choice.bottom<height-64)).toBe(true);
   }
   await big.click();
   await expect(big).toHaveAttribute('aria-pressed','true');
   let keys=await page.locator('#games .catalog-tile').evaluateAll(cards=>cards.map(card=>card.dataset.game));
   expect(keys.slice().sort()).toEqual(deep.slice().sort());
   await expect(page.locator('#gameBrowseCount')).toContainText('big adventures');
   await expect(page.locator('#games [data-game="bubblePop"] .game-session-label')).toContainText('Big adventure');
   await quick.click();
   await expect(quick).toHaveAttribute('aria-pressed','true');
   keys=await page.locator('#games .catalog-tile').evaluateAll(cards=>cards.map(card=>card.dataset.game));
   expect(keys).toContain('snake');expect(keys).toContain('neonSlice');expect(keys).not.toContain('bigFishEnergy');
   expect(keys.every(key=>!deep.includes(key))).toBe(true);
   await expect(page.locator('#gameBrowseCount')).toContainText('2–5 minute sessions');
   await page.locator('#gameSearch').fill('Bubble Pop');
   await expect(quick).toHaveAttribute('aria-pressed','false');
   await expect(page.locator('[data-filter=all]')).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('#games .catalog-tile')).toHaveCount(1);
   await expect(page.locator('#games .catalog-tile')).toHaveAttribute('data-game','bubblePop');
   await page.locator('[data-filter=all]').click();
   await expect(page.locator('#games .catalog-tile')).toHaveCount(await page.evaluate(()=>gameInfo.length));
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
 }
}
