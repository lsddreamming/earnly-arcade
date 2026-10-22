const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const source = fs.readFileSync('web-ads.js','utf8');
async function setup(page, enabled=true) {
  await page.route('**/web-ads.js*', route=>route.fulfill({contentType:'text/javascript',body:source.replace('const ENABLED = false;', `const ENABLED = ${enabled};`)}));
  await page.route('https://pagead2.googlesyndication.com/**',route=>route.fulfill({contentType:'text/javascript',body:`
    const queued = window.adsbygoogle || [];
    function handle(c){if(c.onReady)c.onReady();if(c.type==='reward'){window.adConfigForTest=c;window.adRequests=(window.adRequests||0)+1;c.beforeReward(()=>{window.adShows=(window.adShows||0)+1;c.beforeAd();});}}
    window.adsbygoogle={push:handle};queued.forEach(handle);
  `}));
  await page.goto('/snake.html');
  await expect.poll(()=>page.evaluate(()=>!!window.EarnlyWebAds)).toBe(true);
}
async function request(page, kind='extraPlays') {
  await page.evaluate(kind=>{window.adResult=null;window.EarnlyWebAds.showRewarded(kind).then(r=>window.adResult=r);},kind);
}
async function complete(page, viewed=true) {
  await page.evaluate(viewed=>{let c=window.adConfigForTest;if(viewed)c.adViewed();else c.adDismissed();c.afterAd();c.adBreakDone({breakStatus:viewed?'viewed':'dismissed'});},viewed);
}
test('disabled production adapter never requests Google ads',async({page})=>{
  let requests=0;page.on('request',r=>{if(r.url().includes('googlesyndication'))requests++;});
  await setup(page,false);await request(page);
  await expect.poll(()=>page.evaluate(()=>window.adResult?.reason)).toBe('not-enabled');
  expect(requests).toBe(0);
});
test('reward requires available ad, explicit consent, viewed and finished callbacks',async({page})=>{
  await setup(page);await request(page);
  await expect(page.getByRole('dialog',{name:'Optional video reward'})).toBeVisible();
  expect(await page.evaluate(()=>window.adShows||0)).toBe(0);
  await page.getByRole('button',{name:'Watch ad',exact:true}).click();
  await page.evaluate(()=>window.adConfigForTest.adViewed());
  expect(await page.evaluate(()=>window.adResult)).toBeNull();
  await complete(page);
  await expect.poll(()=>page.evaluate(()=>window.adResult?.earned)).toBe(true);
});
test('decline and late callbacks never reward or open an ad',async({page})=>{
  await setup(page);await request(page);
  await page.getByRole('button',{name:'Not now'}).click();
  await complete(page);
  expect(await page.evaluate(()=>window.adResult.earned)).toBe(false);
  expect(await page.evaluate(()=>window.adShows||0)).toBe(0);
});
test('skipped ad does not earn reward',async({page})=>{
  await setup(page);await request(page);await page.getByRole('button',{name:'Watch ad',exact:true}).click();
  await complete(page,false);await expect.poll(()=>page.evaluate(()=>window.adResult?.earned)).toBe(false);
});
test('duplicate requests rejected and account changes discard reward',async({page})=>{
  await setup(page);await request(page);await expect(page.getByRole('button',{name:'Watch ad',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.EarnlyWebAds.showRewarded())).toMatchObject({earned:false,reason:'busy'});
  await page.getByRole('button',{name:'Watch ad',exact:true}).click();
  await page.evaluate(()=>window.dispatchEvent(new Event('earnly-cloud-auth-change')));await complete(page);
  await expect.poll(()=>page.evaluate(()=>window.adResult?.earned)).toBe(false);
  expect(await page.evaluate(()=>window.adRequests)).toBe(1);
});
test('H5 callback cannot grant daily coin bonus',async({page})=>{
  await setup(page);await request(page,'bonusCoins');
  await expect.poll(()=>page.evaluate(()=>window.adResult?.reason)).toBe('unsupported-placement');
  expect(await page.evaluate(()=>window.EarnlyWebAds.supportsDailyBonus)).toBe(false);
});
test('web extra life resumes once without changing plays or wallet',async({page})=>{
  await setup(page);
  const before=await page.evaluate(()=>({plays:Arcade.remaining('snake'),coins:Arcade.number('points')}));
  await page.evaluate(()=>{window.continued=0;Arcade.offerAdContinue({message:'One extra life',onContinue:()=>window.continued++,onFinish:()=>{}});});
  await page.getByRole('button',{name:'Watch Ad · Continue'}).click();
  await page.getByRole('button',{name:'Watch ad',exact:true}).click();await complete(page);
  await expect.poll(()=>page.evaluate(()=>window.continued)).toBe(1);
  await complete(page);expect(await page.evaluate(()=>window.continued)).toBe(1);
  expect(await page.evaluate(()=>({plays:Arcade.remaining('snake'),coins:Arcade.number('points')}))).toEqual(before);
});
test('native environment cannot use web provider',async({page})=>{
  await setup(page);await page.evaluate(()=>window.Capacitor={isNativePlatform:()=>true});await request(page);
  await expect.poll(()=>page.evaluate(()=>window.adResult?.reason)).toBe('not-enabled');
});
test('no-fill and blocked SDK return without reward',async({page})=>{
  await setup(page);
  await page.route('https://pagead2.googlesyndication.com/**',route=>route.abort());
  await page.clock.install();await request(page);await page.clock.fastForward(16000);
  await expect.poll(()=>page.evaluate(()=>window.adResult?.earned)).toBe(false);
});
test('completed web ad grants one play and duplicate callbacks cannot add more',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{localStorage.setItem('snakeGamesPlayed','3');localStorage.setItem('snakeBonusPlays','0');localStorage.setItem('snakePlayAdUnlocks','0');});
  await page.evaluate(()=>Arcade.playAd('snake'));
  await page.getByRole('button',{name:'Watch ad',exact:true}).click();await complete(page);
  await expect.poll(()=>page.evaluate(()=>Arcade.remaining('snake'))).toBe(1);
  await complete(page);expect(await page.evaluate(()=>Arcade.remaining('snake'))).toBe(1);
});
test('Google no-fill finishes with no reward and no prompt',async({page})=>{
  await setup(page);await page.evaluate(()=>window.adsbygoogle={push:c=>{if(c.onReady)c.onReady();if(c.type==='reward')c.adBreakDone({breakStatus:'noAdPreloaded'});}});
  await request(page);await expect.poll(()=>page.evaluate(()=>window.adResult?.earned)).toBe(false);
  await expect(page.getByRole('dialog',{name:'Optional video reward'})).toHaveCount(0);
});
