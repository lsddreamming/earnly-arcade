const {test,expect}=require('@playwright/test');
const {catalog}=require('../home-featured.js');
const featured=['neonSlice','snake','bubblePop','spuddyEvolution'];

// Reproduce the owner's screenshot, not just the card height: legacy mobile
// grid areas used to win the cascade, overlap text/photos and narrow Play to
// 16px. Cover real loaded photos and fallbacks on root and native mirror.
for(const prefix of ['/', '/www/']){
 for(const width of [320,390,440]){
  for(const pictures of ['loaded','unavailable']){
   test(`starter card grid keeps full-width Play and separates artwork: ${prefix} ${width}px ${pictures}`,async({page,baseURL},info)=>{
    await page.setViewportSize({width,height:956});
    await page.addInitScript(({ids,featured})=>{
     localStorage.setItem('earnly.games.starter.queue.v1',JSON.stringify({
      signature:ids.slice().sort().join('|'),
      remaining:[...featured,...ids.filter(id=>!featured.includes(id))],previous:[]
     }));
    },{ids:catalog.map(game=>game.key),featured});
    if(pictures==='unavailable')await page.route('**/game-preview-*',route=>route.abort());
    await page.goto(new URL(prefix+'games.html',process.env.EARNLY_CATALOG_BASE_URL||baseURL).href);
    const cards=page.locator('#games.starter-grid > .catalog-tile');
    await expect(cards).toHaveCount(4);
    expect(await cards.evaluateAll(nodes=>nodes.map(card=>card.dataset.game))).toEqual(featured);
    const photos=cards.locator('.game-preview-photo');
    await expect(photos).toHaveCount(pictures==='loaded'?4:0);
    if(pictures==='loaded')await expect.poll(()=>photos.evaluateAll(nodes=>nodes.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
    const layout=await cards.evaluateAll(nodes=>nodes.map(card=>{
     const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
     const play=card.querySelector('.game-play-button');
     return {key:card.dataset.game,card:rect(card),areas:getComputedStyle(card).gridTemplateAreas,
      preview:rect(card.querySelector('.game-preview')),play:rect(play),
      textFits:play.scrollWidth<=play.clientWidth+1&&play.scrollHeight<=play.clientHeight+1,
      copy:['.game-title-row','.game-description','.reward-rule'].map(selector=>rect(card.querySelector(selector)))};
    }));
    for(const item of layout){
     expect(item.areas,item.key).toBe('"preview title" "preview description" "preview reward" "play play"');
     expect(item.play.width,item.key).toBeGreaterThan(item.card.width*.85);
     expect(item.play.height,item.key).toBeGreaterThanOrEqual(44);
     expect(item.textFits,item.key).toBe(true);
     for(const box of [item.preview,item.play,...item.copy]){
      expect(box.left,item.key).toBeGreaterThanOrEqual(item.card.left-1);
      expect(box.right,item.key).toBeLessThanOrEqual(item.card.right+1);
      expect(box.top,item.key).toBeGreaterThanOrEqual(item.card.top-1);
      expect(box.bottom,item.key).toBeLessThanOrEqual(item.card.bottom+1);
     }
     for(const box of item.copy){
      const overlap=Math.min(item.preview.right,box.right)-Math.max(item.preview.left,box.left)>1&&
       Math.min(item.preview.bottom,box.bottom)-Math.max(item.preview.top,box.top)>1;
      expect(overlap,item.key+' artwork must not overlap text').toBe(false);
     }
     expect(item.play.top,item.key).toBeGreaterThanOrEqual(Math.max(item.preview.bottom,...item.copy.map(box=>box.bottom))-1);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:info.outputPath(`starter-grid-${width}-${pictures}.png`),fullPage:true});
   });
  }
 }
}
