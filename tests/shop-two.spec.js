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
for(const [id,name,slot,collection] of [['orbit-pet','Orbit Bot','pet','neon'],['ion-army','Ion Legion','army','crystal'],['snow-pet','Snow Sprite','pet','christmas'],['vip-frame','VIP Marquee','frame','vip']])items.push({id,name,slot,collection,coinPrice:200,rarity:'rare',imageUrl:'cosmetic-'+id+'.svg',availableFrom:id==='snow-pet'?'2099-12-01T00:00:00Z':null,vipOnly:collection==='vip'});
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
 await page.route('**/arcade-pass/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(r.request().url().endsWith('/config')?{webAvailable:false,appleAvailable:false,productId:'com.earnly.arcade.vip.monthly'}:{active:false})}));
 await page.goto('/avatars.html');
 await expect(page.locator('#coin-balance')).toHaveText(signedIn?Number(coins).toLocaleString('en-US'):'—');
 return {user,writes};
}

test('Collections preview without spending and future seasonal items cannot be purchased',async({page})=>{
 const f=await setup(page);await page.getByRole('button',{name:'❄ Christmas',exact:true}).click();
 await expect(page.locator('.item-card h3')).toHaveText(['Snow Sprite']);await expect(page.getByRole('button',{name:'Buy Snow Sprite',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Preview Snow Sprite',exact:true}).click();await expect(page.locator('#character-stage img[alt="Snow Sprite"]')).toBeVisible();expect(f.writes).toHaveLength(0);
});
test('Pet purchases retain confirmation and equipped states; Crystal art previews correctly',async({page})=>{
 const f=await setup(page);await page.getByRole('button',{name:'✦ Neon nights',exact:true}).click();await page.getByRole('button',{name:'Buy Orbit Bot',exact:true}).click();
 await expect(page.locator('#purchase-modal')).toBeVisible();expect(f.writes).toHaveLength(0);await page.locator('#confirm-purchase').click();await expect(page.getByRole('button',{name:'Equipped Orbit Bot',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'◆ Crystal Command',exact:true}).click();await expect(page.locator('.item-card img[alt="Ion Legion"]')).toBeVisible();await page.getByRole('button',{name:'Preview Ion Legion',exact:true}).click();await expect(page.locator('#character-stage img')).toHaveCount(1);expect(f.writes).toHaveLength(1);
});
test('VIP stays disabled before configuration and narrow layouts retain readable wallet and controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await expect(page.locator('#pass-buy')).toBeDisabled();await page.locator('#vip-pass summary').click();await expect(page.locator('#pass-disclosure')).toContainText('auto-renewing');await page.getByRole('button',{name:'♛ VIP',exact:true}).click();await expect(page.getByRole('button',{name:'Buy VIP Marquee',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/shop-two-phone.png',fullPage:true});
});
test('Complete Crystal collection shows a server quote and charges only after confirmation',async({page})=>{
 const f=await setup(page);let charges=0,expected;
 await page.route('**/avatars/api/ion-pack',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({price:750,remaining:4})}));
 await page.route('**/avatars/api/shop/ion-pack',r=>{if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,idempotency-key','Access-Control-Allow-Methods':'POST'}});charges++;expected=r.request().postDataJSON().expectedPrice;return r.fulfill({contentType:'application/json',body:JSON.stringify({user:f.user,charged:true,amount:750})});});
 await page.getByRole('button',{name:'◆ Crystal Command',exact:true}).click();await page.locator('#ion-pack-preview').click();await expect(page.locator('.ion-pack-dialog')).toBeVisible();expect(charges).toBe(0);await expect(page.locator('.ion-pack-art img')).toHaveCount(4);await page.getByRole('button',{name:'Confirm · 750 coins',exact:true}).click();await expect(page.locator('.ion-pack-dialog')).toContainText('owned and equipped');expect(charges).toBe(1);expect(expected).toBe(750);
});
