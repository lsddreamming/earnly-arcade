const {selectShopSlot}=require('./shop-category-helper');
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
test('avatar store polish is mirrored and preserves purchase bindings',()=>{
 const root=fs.readFileSync(path.join(__dirname,'../avatars.html'),'utf8');
 const mirror=fs.readFileSync(path.join(__dirname,'../www/avatars.html'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../avatar-shop-finish.css'),'utf8');
 expect(mirror).toBe(root);
 expect(fs.readFileSync(path.join(__dirname,'../www/avatar-shop-finish.css'),'utf8')).toBe(css);
 expect(root).toContain('avatar-shop-finish.css?v=2');
 for(const selector of ['coin-balance','shop-grid','studio-category','free-only','owned-only','shop-sort','affordable-only','character-stage'])expect(root).toContain('id="'+selector+'"');
 expect(css).toContain('.shop-tabs[hidden]{display:none!important}');
});
test('avatar shop remains two-column, navigable and free of horizontal overflow on iPhone',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={ready:false,session:async()=>null};'}));
 await page.goto('/avatars.html',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Style studio',exact:true}).click();
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:780});
  await expect(page.getByRole('group',{name:'Shop category',exact:true})).toBeVisible();
  await expect(page.locator('#character-stage')).toBeVisible();
  await expect(page.locator('#shop-grid')).toBeVisible();
  const result=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth,columns:getComputedStyle(document.getElementById('shop-grid')).gridTemplateColumns.split(' ').length}));
  expect(result.scroll).toBeLessThanOrEqual(result.view);
  expect(result.columns).toBe(2);
 }
 await selectShopSlot(page,'jewelry');
 await expect(page.getByLabel('Gear category',{exact:true})).toHaveValue('jewelry');
 await expect(page.locator('#studio-category')).toHaveValue('jewelry');
});
