const {test,expect}=require('@playwright/test');
async function setup(page,{native=true,earned=true,enabled=true,watched=4,verified=false,progressive=false,unlimited=false}={}){
 await page.route('**/cloud.js',route=>route.fulfill({contentType:'text/javascript',body:`
 window.bonusState={enabled:${enabled},goal:5,coins:100,watched:${watched},awarded:false,resetAt:'2030-01-02T00:00:00Z'};
 window.adCalls=0;window.walletCalls=0;
 ${progressive?'Object.assign(bonusState,{coins:600,perAdCoins:100,completionBonus:100,earnedCoins:bonusState.watched*100});':''}
 ${unlimited?"sessionStorage.setItem('earnlyUnlimitedPlays','1');":''}
 window.EarnlyCloud={adBonus:async()=>({...bonusState}),walletInfo:async()=>{window.walletCalls++;const total=123+(bonusState.earnedCoins??(bonusState.awarded?bonusState.coins:0));return {balance:total,lifetime_earned:total};}};
 window.EarnlyNativeAds={isNative:${native},supportsDailyBonus:true,showRewarded:async()=>{window.adCalls++;${verified?"bonusState.watched++;bonusState.awarded=bonusState.watched===5;if(bonusState.perAdCoins)bonusState.earnedCoins=bonusState.watched*100+(bonusState.awarded?100:0);":''}return {earned:${earned},reason:'dismissed'};}};
 `}));
 await page.goto('/rewards.html');
}
test('server-disabled daily bonus stays hidden',async({page})=>{await setup(page,{enabled:false});await expect(page.locator('#daily-furniture-boost')).toBeHidden();});
test('website explains unavailable ads instead of showing an unusable offer',async({page})=>{await setup(page,{native:false});await expect(page.locator('[data-watch]')).toBeHidden();await expect(page.locator('[data-watch]')).toBeDisabled();await expect(page.locator('.earn-ads-availability')).toContainText('not available on this website');expect(await page.evaluate(()=>adCalls)).toBe(0);});
test('closing ad does not advance progress or credit wallet',async({page})=>{await setup(page,{earned:false});await page.locator('[data-watch]').click();await expect(page.locator('[data-status]')).toContainText('No reward was added');await expect(page.locator('[data-progress]')).toContainText('4 / 5');expect(await page.evaluate(()=>walletCalls)).toBe(0);});
test('SDK reward alone waits for server verification',async({page})=>{await setup(page);await page.locator('[data-watch]').click();await expect(page.locator('[data-watch]')).toBeDisabled();await expect(page.locator('[data-progress]')).toContainText('4 / 5');expect(await page.evaluate(()=>walletCalls)).toBe(0);});
test('fifth verified ad completes daily goal and refreshes wallet once',async({page})=>{await setup(page,{verified:true});await page.locator('[data-watch]').click();await expect(page.locator('[data-progress]')).toContainText('100 Coins earned');await expect(page.locator('[data-watch]')).toBeDisabled();expect(await page.evaluate(()=>walletCalls)).toBe(1);});

test('unlimited-play tester earns 100 coins on the first verified ad',async({page})=>{
 await setup(page,{watched:0,verified:true,progressive:true,unlimited:true});
 await expect(page.locator('[data-watch]')).toContainText('+100 Coins');
 await page.locator('[data-watch]').click();
 await expect(page.locator('[data-progress]')).toContainText('1 / 5 verified today · 100 Coins earned');
 await expect(page.locator('#balance')).toHaveText('223');
 await expect(page.locator('#topBalance')).toHaveText('223');
 await expect(page.locator('#lifetimeEarned')).toHaveText('223');
 await expect(page.locator('[data-watch]')).toBeEnabled();
 expect(await page.evaluate(()=>walletCalls)).toBe(1);
 expect(await page.evaluate(()=>sessionStorage.getItem('earnlyUnlimitedPlays'))).toBe('1');
});
test('fifth progressive ad includes the 100 coin bonus',async({page})=>{
 await setup(page,{verified:true,progressive:true});
 await expect(page.locator('[data-watch]')).toContainText('+100 Coins + 100 bonus');
 await page.locator('[data-watch]').click();
 await expect(page.locator('[data-progress]')).toContainText('600 Coins earned');
 await expect(page.locator('[data-watch]')).toBeDisabled();
});
