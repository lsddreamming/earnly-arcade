const { test, expect } = require('@playwright/test');
// Deterministic test-only catalog and wallet. No calls reach real purchase APIs.
const data = [
 ['cyber-starter','Cyber Starter','avatar',0],['neon-phantom','Neon Phantom','avatar',250],['astra-prime','Astra Prime','avatar',1000],
 ['starter-suit','Pilot Suit','outfit',0],['neon-jacket','Neon Jacket','outfit',300],['storm-coat','Storm Coat','outfit',450],['aurora-armor','Aurora Armor','outfit',750],['solar-jacket','Solar Jacket','outfit',600],
 ['starter-blaster','Training Blaster','weapon',0],['orb-scepter','Orb Scepter','weapon',650],['solar-cannon','Solar Cannon','weapon',850],
 ['trail-boots','Trail Boots','shoes',0],['high-tops','Rose High-Tops','shoes',0],['radiant-boots','Radiant Boots','shoes',400],['neon-kicks','Neon Kicks','shoes',300],
 ['no-backpack','No Backpack','backpack',0],['adventure-pack','Adventure Pack','backpack',350],['aurora-pack','Aurora Pack','backpack',550],
 ['no-beard','Clean Shaven','beard',0],['explorer-beard','Explorer Beard','beard',0],['no-facewear','No Facewear','face',0],['round-glasses','Round Glasses','face',0],['star-goggles','Star Goggles','face',250],['amber-goggles','Amber Goggles','face',350],
 ['no-headwear','No Headwear','head',0],['ribbed-beanie','Ribbed Beanie','head',0],['comms-headset','Comms Headset','head',350],['sun-crown','Sun Crown','head',500],
];
const starters=['cyber-starter','starter-suit','starter-blaster','trail-boots','no-backpack','no-beard','no-facewear','no-headwear'];
const items=data.map(([id,name,slot,coinPrice])=>({id,name,slot,coinPrice,rarity:coinPrice===0?'common':coinPrice>=600?'legendary':'rare',imageUrl:'cosmetic-'+id+'.svg',isStarter:starters.includes(id)}));
const packs=[{id:'starter',coins:500,priceCents:199},{id:'plus',coins:1500,priceCents:499},{id:'vault',coins:4000,priceCents:999}];
async function setup(page,{coins='1250',signedIn=true,native=false}={}) {
 const user={username:'ShopTester',coins,lifetimeEarned:coins,inventory:items.filter(i=>i.coinPrice===0).map(i=>i.id),equipped:Object.fromEntries(items.filter(i=>i.isStarter).map(i=>[i.slot,i])),totalSkinsUnlocked:1};
 const writes=[];
 if(native)await page.addInitScript(()=>{window.Capacitor={isNativePlatform:()=>true};});
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'text/javascript',body:`(()=>{let session=${signedIn?"{access_token:'test',user:{id:'qa'}}":"null"};const listeners=[];const auth={getSession:async()=>({data:{session}}),onAuthStateChange:fn=>{listeners.push(fn);return{};},signOut:async()=>{session=null;listeners.forEach(fn=>fn('SIGNED_OUT'));return{};}};window.EarnlyCloud={client:{auth},session:async()=>session,syncServerRewards:async()=>({}),profile:async()=>null,walletInfo:async()=>null};window.dispatchEvent(new CustomEvent('earnly-cloud-ready'));})();`}));
 await page.route('**/coin-shop/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({available:false,packs})}));
 await page.route('**/avatars/api/**',async r=>{
  const req=r.request(),path=req.url().split('/api')[1];
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,idempotency-key','Access-Control-Allow-Methods':'GET,POST'};
  const respond=(body,status=200)=>r.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});
  if(path==='/config')return respond({supabaseUrl:'https://zdwziebtbpuolusztede.supabase.co',publishableKey:'fixture',game:'snake'});
  if(path==='/shop')return respond({items});
  if(path==='/me')return respond({user});
  if(path==='/leaderboard')return respond({game:'snake',players:[]});
  if(path==='/shop/buy'||path==='/user/equip'){
   const i=items.find(i=>i.id===req.postDataJSON().itemId);writes.push({path,itemId:i.id,key:req.headers()['idempotency-key']});
   if(path==='/shop/buy'&&!user.inventory.includes(i.id)){
    if(BigInt(user.coins)<BigInt(i.coinPrice))return respond({error:{code:'INSUFFICIENT_COINS',message:'Not enough Arcade Coins.'}},409);
    user.coins=String(BigInt(user.coins)-BigInt(i.coinPrice));user.inventory.push(i.id);
   }
   user.equipped[i.slot]=i;return respond({user});
  }
  return respond({error:{message:'Unknown mock route'}},404);
 });
 await page.goto('/avatars.html');
 await expect(page.locator('#coin-balance')).toHaveText(signedIn?Number(coins).toLocaleString('en-US'):'—');
 return {user,writes};
}
test('Lookbook is upfront and prices only the pieces still to unlock',async({page})=>{
 await setup(page);await expect(page.locator('.look-card')).toHaveCount(3);
 await expect(page.locator('.look-card').nth(1).locator('.look-price')).toContainText('3,200');
 expect(await page.locator('#signature-looks').evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('#collection'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBeTruthy();
 await expect(page.locator('#get-coins-link')).toHaveAttribute('href','#coin-shop');
});
test('Complete look preview matches its card and never buys or equips anything',async({page})=>{
 const f=await setup(page);const layers=await page.locator('.look-card').nth(1).locator('.character img').evaluateAll(imgs=>imgs.map(i=>i.src));
 await page.getByRole('button',{name:'Preview Aurora Vanguard',exact:true}).click();
 expect(await page.locator('#character-stage img').evaluateAll(imgs=>imgs.map(i=>i.src))).toEqual(layers);
 await expect(page.locator('#tryon-total')).toHaveText('3,200 coins to unlock');
 expect(f.writes).toHaveLength(0);expect(f.user.equipped.avatar.id).toBe('cyber-starter');
});
test('Compare saved look toggles back to try-on without changing the wallet',async({page})=>{
 const f=await setup(page);await page.getByRole('button',{name:'Preview Aurora Vanguard',exact:true}).click();
 await page.locator('#compare-look').click();await expect(page.locator('#character-stage img[alt="Pilot Suit"]')).toBeVisible();
 await page.locator('#compare-look').click();await expect(page.locator('#character-stage img[alt="Aurora Armor"]')).toBeVisible();
 await expect(page.locator('#coin-balance')).toHaveText('1,250');expect(f.writes).toHaveLength(0);
});
test('Buying one preview item updates remaining look cost and preserves other previews',async({page})=>{
 const f=await setup(page);await page.getByRole('button',{name:'Preview Aurora Vanguard',exact:true}).click();
 await page.getByRole('button',{name:'Unlock preview Neon Phantom',exact:true}).click();await page.locator('#confirm-purchase').click();
 await expect(page.locator('#coin-balance')).toHaveText('1,000');await expect(page.locator('#tryon-total')).toHaveText('2,950 coins to unlock');
 await expect(page.locator('.look-card').nth(1).locator('.look-price')).toContainText('2,950');
 await expect(page.locator('#character-stage img[alt="Aurora Armor"]')).toBeVisible();
 expect(f.writes).toHaveLength(1);expect(f.writes[0].itemId).toBe('neon-phantom');
 await expect(page.getByRole('button',{name:'Preview Aurora Vanguard',exact:true})).toBeEnabled();
});
test('Search spans categories, sorting is deterministic and empty filters can reset',async({page})=>{
 await setup(page);await page.getByLabel('Find your next piece').fill('jacket');await expect(page.locator('.item-card')).toHaveCount(2);
 await expect(page.locator('#shop-result-count')).toContainText('across all categories');await page.locator('#shop-sort').selectOption('price');
 await expect(page.locator('.item-card h3')).toHaveText(['Neon Jacket','Solar Jacket']);
 await page.getByLabel('Find your next piece').fill('not-an-item');await page.getByRole('button',{name:'Clear search & filters',exact:true}).click();
 await expect(page.locator('.item-card')).toHaveCount(3);await expect(page.locator('#shop-search')).toBeFocused();
});
test('Within my balance uses server funds and retains owned items',async({page})=>{
 const f=await setup(page,{coins:'100'});await page.getByLabel('Within my balance').check();await expect(page.locator('.item-card h3')).toHaveText(['Cyber Starter']);
 f.user.inventory.push('astra-prime');await page.locator('#refresh-button').click();await expect(page.locator('.item-card h3')).toHaveText(['Cyber Starter','Astra Prime']);
 expect(f.writes).toHaveLength(0);
});
test('Insufficient funds offers next steps, never charges, and preserves the preview',async({page})=>{
 const f=await setup(page,{coins:'100'});await page.getByRole('button',{name:'Preview Neon Phantom',exact:true}).click();
 await page.getByRole('button',{name:'Unlock preview Neon Phantom',exact:true}).click();await expect(page.locator('#confirm-purchase')).toBeDisabled();
 await expect(page.locator('#purchase-remaining')).toContainText('150 more coins');await page.getByRole('link',{name:'See coin options',exact:true}).click();
 await expect(page.locator('#purchase-modal')).not.toBeVisible();await expect(page.locator('#character-stage img[alt="Neon Phantom"]')).toHaveCount(1);
 await expect(page).toHaveURL(/#coin-shop$/);expect(f.writes).toHaveLength(0);
});
test('Native shortfall never exposes a website checkout link',async({page})=>{
 await setup(page,{coins:'100',native:true});await page.getByRole('button',{name:'Buy Neon Phantom',exact:true}).click();
 await expect(page.getByRole('link',{name:'See coin options',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Play & earn free coins →',exact:true})).toBeVisible();await expect(page.locator('#coin-shop')).toBeHidden();
});
test('Guests can compare looks but must sign in before any purchase',async({page})=>{
 const f=await setup(page,{signedIn:false});await page.getByRole('button',{name:'Preview Aurora Vanguard',exact:true}).click();
 await expect(page.locator('#auth-modal')).not.toBeVisible();await expect(page.locator('#affordable-only')).toBeDisabled();
 await page.getByRole('button',{name:'Unlock preview Neon Phantom',exact:true}).click();await expect(page.locator('#auth-modal')).toBeVisible();expect(f.writes).toHaveLength(0);
});
test('Signing out clears preview totals and comparison state',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Preview Aurora Vanguard',exact:true}).click();await page.locator('#compare-look').click();await page.locator('#auth-button').click();
 await expect(page.locator('#nav-name')).toHaveText('Guest');await expect(page.locator('#tryon-summary')).toBeHidden();await expect(page.locator('#compare-look')).toBeHidden();
});
test('Lookbook stays contained at seven phone, tablet and desktop widths with motion reduced',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page);
 for(const width of [320,390,440,680,768,1024,1280]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow at ${width}px`).toBeTruthy();
  const targets=await page.locator('.shop-tabs button,.look-card button').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().height));for(const height of targets)expect(height).toBeGreaterThanOrEqual(44);
 }
 await expect(page.locator('#coin-packs button')).toHaveCount(3);for(const button of await page.locator('#coin-packs button').all())await expect(button).toBeDisabled();
});
test('Shop styling preserves hidden extra-play controls for guests and after sign-out',async({page})=>{
 const f=await setup(page);
 await expect(page.locator('#extra-plays')).toBeVisible();
 await page.locator('#auth-button').click();
 await expect(page.locator('#nav-name')).toHaveText('Guest');
 await expect(page.locator('#extra-plays')).toBeHidden();
 await expect(page.locator('#buy-plays')).toBeHidden();
 expect(f.writes).toHaveLength(0);
});
test('Narrow category rail reaches the last category and returns without spending coins',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 const f=await setup(page);
 await page.getByRole('button',{name:'Weapons',exact:true}).click();
 await expect(page.locator('.item-card h3')).toHaveText(['Training Blaster','Orb Scepter','Solar Cannon']);
 await page.getByRole('button',{name:'Avatars',exact:true}).click();
 await expect(page.locator('.item-card h3')).toHaveText(['Cyber Starter','Neon Phantom','Astra Prime']);
 await expect(page.locator('#coin-balance')).toHaveText('1,250');
 expect(f.writes).toHaveLength(0);
});
test('Phone coin rail reveals its last pack without decorative layers blocking buttons',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});const f=await setup(page);
 await expect(page.locator('#coin-packs button')).toHaveCount(3);
 expect(await page.locator('#coin-packs').evaluate(e=>e.scrollWidth>e.clientWidth)).toBeTruthy();
 const last=page.locator('#coin-packs button').last();
 await last.evaluate(e=>e.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
 await expect.poll(()=>last.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBeTruthy();
 await expect(last).toBeDisabled();expect(f.writes).toHaveLength(0);
 await expect(page.locator('.header')).toHaveCSS('position','relative');
});
test('Continue browsing returns to a searched item without changing the preview or wallet',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const f=await setup(page);
 await page.locator('#shop-search').fill('Neon');
 await page.locator('#shop-sort').selectOption('price');
 const preview=page.getByRole('button',{name:'Preview Neon Jacket',exact:true});
 await preview.click();
 await expect(page.locator('#character-stage img[alt="Neon Jacket"]')).toHaveCount(1);
 await page.getByRole('button',{name:'Continue browsing',exact:true}).click();
 await expect(preview).toBeFocused();
 await expect(preview).toBeInViewport();
 await expect(page.locator('#shop-search')).toHaveValue('Neon');
 await expect(page.locator('#shop-sort')).toHaveValue('price');
 await expect(page.locator('#character-stage img[alt="Neon Jacket"]')).toHaveCount(1);
 await expect(page.locator('#coin-balance')).toHaveText('1,250');
 expect(f.writes).toHaveLength(0);
});
test('Lookbook continue browsing opens the collection with a keyboard destination',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page);
 await page.getByRole('button',{name:'Preview Aurora Vanguard',exact:true}).click();
 await page.getByRole('button',{name:'Continue browsing',exact:true}).click();
 await expect(page.locator('#shop-search')).toBeFocused();
 await expect(page.locator('#shop-title')).toBeInViewport();
});

test('Coin comparisons follow current prices and the collection stays one tap away',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const f=await setup(page);
 await expect(page.locator('.pack-rate')).toHaveText(['$0.40 per 100 coins','$0.33 per 100 coins','$0.25 per 100 coins']);
 await expect(page.locator('.coin-pack.best-value h3')).toHaveText('Arcade vault');
 await page.locator('#coin-shop').scrollIntoViewIfNeeded();
 await page.screenshot({path:test.info().outputPath('shop-wallet.png')});
 await page.getByRole('link',{name:'Explore what you can unlock'}).click();
 await expect(page.locator('#shop-title')).toBeInViewport();
 await page.screenshot({path:test.info().outputPath('shop-collection.png')});
 expect(f.writes).toHaveLength(0);
 await page.route('**/coin-shop/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({available:false,packs:[{id:'starter',coins:500,priceCents:99},{id:'vault',coins:4000,priceCents:999}]})}));
 await page.reload();
 await expect(page.locator('.coin-pack.best-value h3')).toHaveText('Starter stash');
 await expect(page.locator('.pack-rate').first()).toHaveText('$0.20 per 100 coins');
});
