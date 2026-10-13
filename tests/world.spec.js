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
