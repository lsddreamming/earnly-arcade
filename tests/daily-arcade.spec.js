const {test,expect}=require('@playwright/test');
const state={day:'2026-11-04',week:'2026-11-02',resetAt:'2099-11-05T00:00:00Z',weekResetAt:'2099-11-09T00:00:00Z',goals:[{game:'spiralDrop',goal:8,progress:8},{game:'bounceRun',goal:60,progress:20},{game:'neonSlice',goal:120,progress:0}],days:['2026-11-02','2026-11-04'],reward:'Arcade All-Star Cup',delivered:false,pending:false,totalAwards:0};
async function setup(page,data=state,expanded=true){
 await page.addInitScript(()=>localStorage.setItem('arcadeOnboardingSeen','1'));
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:`window.challengeResponse=${JSON.stringify(data)};window.EarnlyCloud={arcadeChallenge:async()=>{if(window.challengeError)throw Error('offline');return window.challengeResponse;}};`}));
 await page.goto('/index.html');
 await expect(page.locator('#daily-arcade')).toHaveAttribute('aria-busy','false');
 if(expanded){
  await page.locator('.daily-challenge-summary').click();
  await page.locator('.daily-reward-details>summary').click();
 }
}
test('visible card has three direct game links and saved weekly progress',async({page},testInfo)=>{
 await setup(page);const card=page.locator('#daily-arcade');
 await expect(card.locator('[data-goals] li')).toHaveCount(3);
 await expect(card.locator('[data-count]')).toHaveText('1/3 complete');
 await expect(card.locator('[data-week-count]')).toHaveText('2 / 4 days');
 await expect(card.getByRole('link',{name:'Play Bounce Run',exact:true})).toHaveAttribute('href','mini.html?game=bounceRun');
 await expect(card.getByRole('link',{name:'Play Neon Slice',exact:true})).toHaveAttribute('href','neon-slice.html');
 await card.scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await card.screenshot({path:testInfo.outputPath('daily-arcade-card.png')});
 await card.getByRole('link',{name:'Play Bounce Run',exact:true}).click();await expect(page).toHaveURL(/mini.html\?game=bounceRun/);
});
test('guests can play without being promised saved stamps',async({page})=>{
 await setup(page,null);const card=page.locator('#daily-arcade');
 await expect(card.getByRole('link',{name:'Sign in to earn your trophy'})).toBeVisible();
 await expect(card.locator('[data-message]')).toContainText('guest');
 await expect(card.locator('[data-week-count]')).toHaveText('0 / 4 days');
});
test('sign-out clears account progress and ignores an older in-flight response',async({page})=>{
 await setup(page);await page.evaluate(()=>{
  const old=window.challengeResponse;
  window.EarnlyCloud.arcadeChallenge=()=>new Promise(resolve=>{window.releaseOld=()=>resolve(old);});
  window.dispatchEvent(new Event('earnly-server-rewards-synced'));
 });
 await expect(page.locator('#daily-arcade')).toHaveAttribute('aria-busy','true');
 await page.evaluate(()=>{window.EarnlyCloud.arcadeChallenge=async()=>null;window.dispatchEvent(new Event('earnly-cloud-auth-change'));});
 await expect(page.locator('[data-signin]')).toBeVisible();
 await page.evaluate(()=>window.releaseOld());await expect(page.locator('[data-week-count]')).toHaveText('0 / 4 days');
});
test('failure is retryable and full Backpack keeps the earned reward visible',async({page})=>{
 await setup(page);await page.evaluate(()=>{window.challengeError=true;window.dispatchEvent(new Event('earnly-server-rewards-synced'));});
 await expect(page.locator('[data-message]')).toContainText('Could not check');
 await page.evaluate(()=>{window.challengeError=false;window.challengeResponse.pending=true;});
 await page.getByRole('button',{name:'Check progress again'}).click();
 await expect(page.locator('[data-reward-status]')).toContainText('Collectible earned');
 await page.evaluate(()=>{window.challengeResponse.pending=false;window.challengeResponse.delivered=true;window.dispatchEvent(new Event('earnly-server-rewards-synced'));});
 await expect(page.locator('[data-reward-status]')).toContainText('Yours!');
 await expect(page.locator('[data-world]')).toBeVisible();
});

test('daily bonus and room collectible preview reflect server confirmation',async({page})=>{
 await setup(page,{...state,dailyBonus:50,dailyBonusPaid:false,reward:'Neon Champion Cabinet',rewardPreview:{name:'Neon Champion Cabinet',sprite:'arcade',color:'#b28aff'},nextReward:'Starlight Room Lamp'});
 await expect(page.locator('[data-daily-bonus]')).toContainText('+50 Arcade Coins');
 await expect(page.locator('[data-prize-name]')).toHaveText('Neon Champion Cabinet');
 await page.getByText('Preview in a room',{exact:true}).click();
 await expect(page.locator('[data-room-preview]')).toBeVisible();
 await expect(page.locator('[data-next-reward]')).toContainText('Starlight Room Lamp');
 await page.evaluate(()=>{window.challengeResponse.dailyBonusPaid=true;window.dispatchEvent(new Event('earnly-server-rewards-synced'));});
 await expect(page.locator('[data-daily-bonus]')).toContainText('50 Arcade Coins added');
});

for(const width of [320,390,440]) test(`Home challenge stays compact until opened at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await setup(page,state,false);
 const card=page.locator('#daily-arcade');
 await expect(card.locator('[data-count]')).toHaveText('1/3 complete');
 await expect(card.locator('[data-goals]')).toBeHidden();
 await expect(card.locator('.daily-arcade-prize')).toBeHidden();
 expect((await card.boundingBox()).height).toBeLessThan(120);
 await card.locator('.daily-challenge-summary').click();
 await expect(card.getByRole('link',{name:'Play Bounce Run',exact:true})).toBeVisible();
 await expect(card.locator('.daily-arcade-prize')).toBeHidden();
 await card.locator('.daily-reward-details>summary').click();
 await expect(card.locator('.daily-arcade-prize')).toBeVisible();
 await card.locator('.daily-challenge-summary').click();
 await expect(card.locator('[data-goals]')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
});
