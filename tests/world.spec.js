const {test,expect}=require('@playwright/test');
test('World preview fits narrow screens and exposes catalog without enabling purchases',async({page})=>{
 await page.route('**/cloud.js',route=>route.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>null};'}));
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:320,height:740});await page.goto('/world.html');
 await expect(page.locator('#connectionStatus')).toContainText('Preview');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
 await page.getByRole('button',{name:'Catalog',exact:false}).click();
 await expect(page.locator('.item-card')).toHaveCount(10);
 await expect(page.locator('.item-card button').first()).toBeDisabled();
 await page.getByRole('button',{name:'Close panel'}).click();
 await page.getByRole('button',{name:'Backpack',exact:false}).click();
 await expect(page.locator('#panelContent')).toContainText('stored here');
 expect(errors).toEqual([]);
});


test('World reports server configuration failure without asking players to sign in again',async({page})=>{
 await page.route('**/cloud.js',route=>route.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"test-player-token"})};'}));
 await page.route('https://*.supabase.co/**',route=>route.fulfill({status:404,body:''}));
 await page.addInitScript(()=>{
  window.worldSockets=[];
  window.WebSocket=class {
   constructor(){this.readyState=0;window.worldSockets.push(this);}
   close(){this.readyState=3;this.onclose?.({code:1000,reason:''});}
   failConfig(){this.readyState=3;this.onclose?.({code:1011,reason:'World service configuration'});}
  };
 });
 await page.goto('/world.html?multiplayer=1');
 await expect(page.locator('#reconnect')).toBeDisabled();
 await expect(page.locator('#connectionStatus')).toContainText('Connecting');
 await page.locator('#reconnect').evaluate(button=>button.click());
 expect(await page.evaluate(()=>window.worldSockets.length)).toBe(1);
 await page.evaluate(()=>window.worldSockets[0].failConfig());
 await expect(page.locator('#connectionStatus')).toContainText('Server setup needs attention');
 await expect(page.locator('#connectionStatus')).not.toContainText('Sign in');
 await expect(page.locator('#peopleCount')).toHaveText('Room preview');
 await expect(page.locator('#reconnect')).toBeEnabled();
 for(const selector of ['#worldCanvas','#reconnect','.world-tools']){
  expect(await page.locator(selector).evaluate(el=>getComputedStyle(el).userSelect)).toBe('none');
 }
 expect(await page.locator('#sayText').evaluate(el=>getComputedStyle(el).userSelect)).toBe('text');
});
