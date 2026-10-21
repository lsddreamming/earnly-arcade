const { test, expect } = require('@playwright/test');

async function offer(page, outcome) {
  await page.goto('/snake.html');
  await page.evaluate(outcome => {
    window.continueCalls = 0; window.finishCalls = 0; window.adCalls = 0;
    window.EarnlyNativeAds = { isNative:true, showRewarded:async () => {
      window.adCalls++;
      if(outcome==='error') throw new Error('offline');
      return {earned:outcome==='earned'};
    }};
    Arcade.offerAdContinue({message:'Keep your score. One life per run.',
      onContinue:()=>window.continueCalls++, onFinish:()=>window.finishCalls++});
  }, outcome);
}

test('completed ad resumes once without granting or charging plays or coins', async ({page}) => {
  await offer(page, 'earned');
  const before = await page.evaluate(()=>({plays:Arcade.remaining('snake'),coins:Arcade.number('points')}));
  await page.getByRole('button',{name:'Watch Ad · Continue'}).click();
  await expect.poll(()=>page.evaluate(()=>window.continueCalls)).toBe(1);
  expect(await page.evaluate(()=>({plays:Arcade.remaining('snake'),coins:Arcade.number('points')}))).toEqual(before);
  expect(await page.evaluate(()=>window.adCalls)).toBe(1);
});
for(const outcome of ['closed','error']) test(outcome+' keeps run pending and allows finishing without reward', async({page})=>{
  await offer(page,outcome);
  await page.getByRole('button',{name:'Watch Ad · Continue'}).click();
  await expect(page.getByRole('button',{name:'Finish run'})).toBeVisible();
  expect(await page.evaluate(()=>window.continueCalls)).toBe(0);
  await page.getByRole('button',{name:'Finish run'}).click();
  await expect.poll(()=>page.evaluate(()=>window.finishCalls)).toBe(1);
});
test('web does not offer a simulated rewarded life', async({page})=>{
  await page.goto('/snake.html');
  expect(await page.evaluate(()=>{window.EarnlyNativeAds={isNative:false};return Arcade.offerAdContinue({});})).toBe(false);
});

for(const game of ['snake','stardefender']) test(game+' preserves progress and offers only one life before final payout', async({page})=>{
  if(game==='stardefender') await page.route('**/stardefender.html*',async route=>{
    const response=await route.fetch();
    const html=(await response.text()).replace('    function finish(finalize=false)', `    window.lifeTest={die:()=>{score=240;wave=3;lives=0;elapsed=20;running=true;finish()},used:()=>bonusLifeUsed,score:()=>score,end:()=>{lives=0;finish()}};
    function finish(finalize=false)`);
    await route.fulfill({response,body:html});
  });
  await page.goto('/'+game+'.html'+(game==='stardefender'?'?sd=20260925d':''));
  await page.evaluate(game=>{
    window.EarnlyNativeAds={isNative:true,showRewarded:async()=>({earned:true})};
    window.payouts=0; Arcade.earn=()=>window.payouts++;
    Arcade.countdown=fn=>fn();
    if(game==='snake'){
      score=12;snake=[{x:0,y:0}];food={x:100,y:100};
      window.eval('game=setInterval(()=>{},10000);gameOver("Hit wall")');
    }else{
      window.lifeTest.die();
    }
  },game);
  expect(await page.evaluate(()=>window.payouts)).toBe(0);
  await page.getByRole('button',{name:'Watch Ad · Continue'}).click();
  await expect.poll(()=>page.evaluate(game=>game==='snake'?bonusLifeUsed:window.lifeTest.used(),game)).toBe(true);
  expect(await page.evaluate(game=>game==='snake'?score:window.lifeTest.score(),game)).toBe(game==='snake'?12:240);
  await page.evaluate(game=>{if(game==='snake') gameOver('Hit wall');else window.lifeTest.end();},game);
  await expect.poll(()=>page.evaluate(()=>window.payouts)).toBe(1);
  await expect(page.getByRole('button',{name:'Watch Ad · Continue'})).toHaveCount(0);
});
