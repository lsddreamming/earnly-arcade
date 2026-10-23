const {test,expect}=require('@playwright/test');
const pages=['taprush','memory','brickbreaker','junglehopper','towerstack','coincatch','colormatch','paddlerally','lanerunner','safecracker','stardefender'].map(n=>n+'.html').concat(['mergeRush','perfectDrop','spiralDrop','shapeFit','bounceRun','trafficEscape'].map(n=>'mini.html?game='+n));
for(const path of pages){
 test('Classic game clarity: '+path,async({page})=>{
  await page.route('https://**',r=>r.abort());
  await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');});
  await page.goto('/'+path);
  for(const width of [320,390,440]){
   await page.setViewportSize({width,height:844});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth),path+' overflow').toBeLessThanOrEqual(width+1);
   const stats=await page.locator('.game-meta .meta-pill').evaluateAll(ns=>ns.map(n=>({font:parseFloat(getComputedStyle(n).fontSize),width:n.clientWidth,scroll:n.scrollWidth})));
   expect(stats.length).toBeGreaterThan(0);
   for(const stat of stats){expect(stat.font).toBeGreaterThanOrEqual(11);expect(stat.scroll).toBeLessThanOrEqual(stat.width+1);}
   // Touch devices start by tapping the board; the separate button is intentionally hidden.
   const button=page.locator('#startButton');
   const start=await button.isVisible()?button:page.locator('#surface,.game-guide-surface').first();
   await expect(start).toBeVisible();
   expect((await start.boundingBox()).height).toBeGreaterThanOrEqual(44);
   expect((await start.boundingBox()).y).toBeLessThan(340);
   await expect(page.locator('.game-guide-strip')).toBeHidden();
  }
  const help=page.locator('.game-guide-more > summary');
  if(await help.count()){
   await help.click();await expect(page.locator('.game-guide-more')).toHaveAttribute('open','');
   await expect(page.locator('.game-guide-more')).toContainText(/Coin|reward/i);
  }
 });
}
test('Classic presentation stays out of the two excluded games and mirrors the native bundle',async({page})=>{
 for(const path of ['crystal-command.html','neonbreach.html']){
  const html=await (await page.request.get('/'+path)).text();expect(html).not.toContain('classic-game-ui');
 }
 for(const path of [...new Set(pages.map(p=>p.split('?')[0])),'classic-game-ui.css']){
  const [web,native]=await Promise.all([page.request.get('/'+path).then(r=>r.text()),page.request.get('/www/'+path).then(r=>r.text())]);expect(native,path).toBe(web);
 }
});
