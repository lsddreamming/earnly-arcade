const {selectShopSlot}=require('./shop-category-helper');
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
test('avatar store polish is mirrored and preserves purchase bindings',()=>{
 const root=fs.readFileSync(path.join(__dirname,'../avatars.html'),'utf8');
 const mirror=fs.readFileSync(path.join(__dirname,'../www/avatars.html'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../avatar-shop-finish.css'),'utf8');
 expect(mirror).toBe(root);
 expect(fs.readFileSync(path.join(__dirname,'../www/avatar-shop-finish.css'),'utf8')).toBe(css);
 expect(root).toContain('avatar-shop-finish.css?v=6');
 for(const selector of ['coin-balance','shop-grid','studio-category','free-only','owned-only','shop-sort','affordable-only','character-stage'])expect(root).toContain('id="'+selector+'"');
 expect(css).toContain('.shop-tabs[hidden]{display:none!important}');
 for(const name of ['silver-chain','gold-chain','spud-pendant']){
  const art=fs.readFileSync(path.join(__dirname,'../cosmetic-'+name+'.svg'),'utf8');
  const packed=fs.readFileSync(path.join(__dirname,'../www/cosmetic-'+name+'.svg'),'utf8');
  expect(packed).toBe(art);
  // Keep enlarged jewelry vector-sharp without rasterizing the whole chain.
  expect(art).not.toMatch(/<filter\b|\bfilter\s*=/);
  expect(art).toContain('viewBox="0 0 300 400"');
  expect(art).toContain('id="chain-metal"');
  expect((art.match(/<ellipse\b/g)||[]).length).toBeGreaterThanOrEqual(44);
  expect(art).toContain('id="edge-shine"');
 }
 expect(fs.readFileSync(path.join(__dirname,'../cosmetic-spud-pendant.svg'),'utf8')).toContain('id="gem-face"');
 for(const name of ['neon-jacket','aurora-armor','storm-coat','boardwalk-jacket']){
  const art=fs.readFileSync(path.join(__dirname,'../cosmetic-'+name+'.svg'),'utf8');
  const packed=fs.readFileSync(path.join(__dirname,'../www/cosmetic-'+name+'.svg'),'utf8');
  expect(packed).toBe(art);
  expect(art).toContain('id="outfit-polish"');
  expect(art).toContain('id="outfit-polish-sheen"');
 }
});
test('avatar shop remains two-column, navigable and free of horizontal overflow on iPhone',async({page})=>{
 // Isolate the layout check from live authentication and catalog responses.
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={client:{auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({})}},session:async()=>null};'}));
 await page.route('**/avatars/api/**',r=>{
  const endpoint=new URL(r.request().url()).pathname.split('/api/')[1];
  if(endpoint==='config')return r.fulfill({json:{supabaseUrl:'https://zdwziebtbpuolusztede.supabase.co',publishableKey:'fixture',game:'snake'}});
  if(endpoint==='shop')return r.fulfill({json:{items:[{id:'cyber-starter',name:'Cyber Starter',slot:'avatar',coinPrice:0,rarity:'common',isStarter:true,imageUrl:'cosmetic-cyber-starter.svg'},{id:'starter-suit',name:'Pilot Suit',slot:'outfit',coinPrice:0,rarity:'common',isStarter:true,imageUrl:'cosmetic-starter-suit.svg'},{id:'trail-boots',name:'Trail Boots',slot:'shoes',coinPrice:0,rarity:'common',isStarter:true,imageUrl:'cosmetic-trail-boots.svg'},{id:'silver-chain',name:'Silver Chain',slot:'jewelry',coinPrice:200,rarity:'rare',imageUrl:'cosmetic-silver-chain.svg'}]}});
  if(endpoint==='leaderboard')return r.fulfill({json:{game:'snake',players:[]}});
  return r.fulfill({status:404,json:{error:{message:'Unexpected QA request'}}});
 });
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
  const stage=await page.locator('#character-stage').boundingBox();
  const collections=await page.locator('.shop-collections').boundingBox();
  expect(stage.y+stage.height).toBeLessThan(collections.y);
  await expect(page.locator('.showcase .earn-coins-shop')).toBeVisible();
 }
 await page.screenshot({path:test.info().outputPath('studio-phone.png'),fullPage:true});
 await selectShopSlot(page,'jewelry');
 await expect(page.getByLabel('Gear category',{exact:true})).toHaveValue('jewelry');
 await expect(page.locator('#studio-category')).toHaveValue('jewelry');
 await expect(page.locator('#studio-category')).toBeHidden();
 await expect(page.locator('.studio-category-label')).toBeHidden();
 await expect(page.locator('[data-gear-view="detail"]')).toHaveAttribute('aria-pressed','true');
 const firstCard=page.locator('#shop-grid .item-card').first();
 await expect(firstCard).toBeVisible();
 await expect(firstCard.locator('.preview-item')).toBeHidden();
 await expect(firstCard.locator('.item-art-trigger')).toBeVisible();
 await selectShopSlot(page,'building');
 await expect(page.locator('.gear-view')).toBeHidden();
 await expect(page.locator('.public-footer nav a:visible')).toHaveCount(3);
 await expect(page.locator('.public-footer nav a:visible')).toHaveText(['Help & Contact','Privacy','Terms']);
});
