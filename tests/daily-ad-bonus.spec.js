const {test,expect}=require('@playwright/test');
async function setup(page,{native=true,earned=true,enabled=true,watched=4,verified=false}={}){
 await page.route('**/cloud.js',route=>route.fulfill({contentType:'text/javascript',body:`
 window.bonusState={enabled:${enabled},watched:${watched},awarded:false,resetAt:'2030-01-02T00:00:00Z'};
 window.adCalls=0;window.walletCalls=0;
 window.EarnlyCloud={adBonus:async()=>({...bonusState}),walletInfo:async()=>{window.walletCalls++;return null;}};
 window.EarnlyNativeAds={isNative:${native},supportsDailyBonus:true,showRewarded:async()=>{window.adCalls++;${verified?"bonusState.watched=5;bonusState.awarded=true;":''}return {earned:${earned},reason:'dismissed'};}};
 `}));
 await page.goto('/rewards.html');
}
test('server-disabled daily bonus stays hidden',async({page})=>{await setup(page,{enabled:false});await expect(page.locator('#daily-furniture-boost')).toBeHidden();});
test('website shows progress but never offers a fake ad',async({page})=>{await setup(page,{native:false});await expect(page.locator('[data-watch]')).toBeDisabled();await expect(page.locator('[data-progress]')).toContainText('4 / 5');});
test('closing ad does not advance progress or credit wallet',async({page})=>{await setup(page,{earned:false});await page.locator('[data-watch]').click();await expect(page.locator('[data-status]')).toContainText('unchanged');await expect(page.locator('[data-progress]')).toContainText('4 / 5');expect(await page.evaluate(()=>walletCalls)).toBe(0);});
test('SDK reward alone waits for server verification',async({page})=>{await setup(page);await page.locator('[data-watch]').click();await expect(page.locator('[data-watch]')).toBeDisabled();await expect(page.locator('[data-progress]')).toContainText('4 / 5');expect(await page.evaluate(()=>walletCalls)).toBe(0);});
test('fifth verified ad completes daily goal and refreshes wallet once',async({page})=>{await setup(page,{verified:true});await page.locator('[data-watch]').click();await expect(page.locator('[data-progress]')).toContainText('100 Coins earned');await expect(page.locator('[data-watch]')).toBeDisabled();expect(await page.evaluate(()=>walletCalls)).toBe(1);});
