const {test,expect}=require('@playwright/test');
const API='https://zdwziebtbpuolusztede.supabase.co/functions/v1/avatars/api';
const item=(id,name,slot,price,rarity)=>({id,name,slot,coinPrice:price,rarity,imageUrl:'cosmetic-'+id+'.svg'});
const items=[item('cyber-starter','Cyber Starter','avatar',0,'common'),item('neon-phantom','Neon Phantom','avatar',250,'rare'),item('astra-prime','Astra Prime','avatar',1000,'legendary'),item('starter-suit','Pilot Suit','outfit',0,'common'),item('neon-jacket','Neon Jacket','outfit',300,'rare'),item('starter-blaster','Training Blaster','weapon',0,'common'),item('pulse-blade','Pulse Blade','weapon',400,'rare')];
items.push(item('trail-boots','Trail Boots','shoes',0,'common'),item('canvas-shoes','Canvas Sneakers','shoes',0,'common'),item('neon-kicks','Neon Kicks','shoes',300,'rare'),item('no-backpack','No Backpack','backpack',0,'common'),item('canvas-pack','Canvas Backpack','backpack',0,'common'),item('no-beard','Clean Shaven','beard',0,'common'),item('short-beard','Short Beard','beard',0,'common'),item('explorer-beard','Explorer Beard','beard',0,'common'),item('no-facewear','No Facewear','face',0,'common'),item('round-glasses','Round Glasses','face',0,'common'),item('sport-shades','Sport Shades','face',0,'common'));
items.push(item('no-headwear','No Headwear','head',0,'common'),item('ribbed-beanie','Ribbed Beanie','head',0,'common'),item('arcade-cap','Arcade Cap','head',0,'common'),item('comms-headset','Comms Headset','head',350,'rare'),item('high-tops','Rose High-Tops','shoes',0,'common'));
for (const id of ['cyber-starter','starter-suit','starter-blaster','trail-boots','no-backpack','no-beard','no-facewear','no-headwear'])items.find(i=>i.id===id).isStarter=true;
function player(){return {username:'PlayerOne',coins:'1250',lifetimeEarned:'1250',inventory:items.filter(i=>i.coinPrice===0).map(i=>i.id),equipped:Object.fromEntries(items.filter(i=>i.isStarter).map(i=>[i.slot,i])),equippedAvatarId:'cyber-starter',totalSkinsUnlocked:1};}
function profile(user){return {username:user.username,rank:'2',highScore:'120',gamesPlayed:8,totalSkinsUnlocked:user.totalSkinsUnlocked,game:'snake',equipped:user.equipped,equippedAvatar:user.equipped.avatar};}
async function setup(page,{signedIn=true,insufficient=false,networkRetry=false}={}){
  let user=player(),buys=0,keys=[];
  await page.route('**/cloud.js',route=>route.fulfill({contentType:'text/javascript',body:`(() => {
    const session=${signedIn?"{access_token:'test',user:{id:'qa-account'}}":"null"};
    const auth={getSession:async()=>({data:{session}}),onAuthStateChange:()=>({}),signOut:async()=>({}),signInWithPassword:async()=>({})};
    window.EarnlyCloud={client:{auth},session:async()=>session,syncServerRewards:async()=>({}),profile:async()=>null,leaderboard:async()=>({entries:[{rank:1,username:'PlayerOne',score:120,avatar:'🤖',avatarUrl:'cosmetic-neon-phantom.svg',avatarRarity:'rare'}]}),walletInfo:async()=>null};
    window.dispatchEvent(new CustomEvent('earnly-cloud-ready'));
  })();`}));
  await page.route(API+'/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname.split('/api')[1];
    const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,idempotency-key','Access-Control-Allow-Methods':'GET,POST'}});
    if(path==='/config')return respond({supabaseUrl:'https://zdwziebtbpuolusztede.supabase.co',publishableKey:'test',game:'snake'});
    if(path==='/shop')return respond({items});
    if(path==='/me')return signedIn?respond({user}):respond({error:{message:'Sign in required'}},401);
    if(path==='/leaderboard')return respond({game:'snake',players:[profile(user)]});
    if(path.startsWith('/user/PlayerOne'))return respond({profile:profile(user)});
    if(path==='/shop/buy'){
      ++buys;keys.push(req.headers()['idempotency-key']);
      if(networkRetry&&buys===1)return route.abort();
      const data=req.postDataJSON(),i=items.find(x=>x.id===data.itemId);
      if(insufficient||BigInt(user.coins)<BigInt(i.coinPrice))return respond({error:{code:'INSUFFICIENT_COINS',message:'Not enough Arcade Coins for this item.'}},409);
      if(!user.inventory.includes(i.id)){user.inventory.push(i.id);user.coins=String(BigInt(user.coins)-BigInt(i.coinPrice));}
      user.equipped[i.slot]=i;user.equippedAvatarId=user.equipped.avatar.id;user.totalSkinsUnlocked=user.inventory.filter(id=>items.find(i=>i.id===id).slot==='avatar').length;
      return respond({charged:true,amount:i.coinPrice,user});
    }
    if(path==='/user/equip'){const i=items.find(x=>x.id===req.postDataJSON().itemId);user.equipped[i.slot]=i;user.equippedAvatarId=user.equipped.avatar.id;return respond({user});}
    return respond({error:{message:'Unknown route'}},404);
  });
  return {keys,user:()=>user};
}
test('Character Studio purchases and equips persist in header, profile and slots',async({page})=>{
  await setup(page);await page.goto('/avatars.html');await expect(page.locator('#coin-balance')).toHaveText('1,250');
  await page.getByRole('button',{name:'Buy Neon Phantom',exact:true}).click();await page.getByRole('button',{name:'Buy & equip',exact:true}).click();
  await expect(page.locator('#coin-balance')).toHaveText('1,000');await expect(page.getByRole('button',{name:'Equipped Neon Phantom',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Outfits',exact:true}).click();await page.getByRole('button',{name:'Buy Neon Jacket',exact:true}).click();await page.getByRole('button',{name:'Buy & equip',exact:true}).click();
  await expect(page.locator('#coin-balance')).toHaveText('700');await expect(page.locator('#character-name')).toHaveText('Neon Phantom');
  await page.getByRole('button',{name:'View my profile'}).click();await expect(page.locator('#modal-username')).toHaveText('@PlayerOne');await expect(page.locator('#modal-rarity')).toHaveText('RARE');await expect(page.locator('#modal-loadout')).toContainText('Neon Jacket');
  await page.keyboard.press('Escape');await expect(page.locator('#profile-modal')).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('Insufficient Coins leave balance unchanged and show clean error',async({page})=>{
  await setup(page,{insufficient:true});await page.goto('/avatars.html');await expect(page.locator('#nav-name')).toHaveText('@PlayerOne');
  await page.getByRole('button',{name:'Buy Astra Prime',exact:true}).click();await page.getByRole('button',{name:'Buy & equip',exact:true}).click();await expect(page.locator('#purchase-error')).toHaveText('Not enough Arcade Coins for this item.');await expect(page.locator('#coin-balance')).toHaveText('1,250');
});
test('Network retries reuse the purchase request and support cancellation',async({page})=>{
  const f=await setup(page,{networkRetry:true});await page.goto('/avatars.html');await expect(page.locator('#nav-name')).toHaveText('@PlayerOne');
  await page.getByRole('button',{name:'Buy Neon Phantom',exact:true}).click();await page.getByRole('button',{name:'Buy & equip',exact:true}).click();await expect(page.locator('#purchase-error')).not.toBeEmpty();
  await page.getByRole('button',{name:'Buy & equip',exact:true}).click();await expect(page.locator('#coin-balance')).toHaveText('1,000');expect(f.keys).toHaveLength(2);expect(f.keys[0]).toBe(f.keys[1]);
});
test('Guests browse but sign in before attempting purchases',async({page})=>{
  await setup(page,{signedIn:false});await page.goto('/avatars.html');await expect(page.locator('#nav-name')).toHaveText('Guest');await page.getByRole('button',{name:'Buy Neon Phantom',exact:true}).click();await expect(page.locator('#auth-modal')).toBeVisible();await expect(page.locator('#coin-balance')).toHaveText('—');
});
test('Existing Profile links to the studio and displays the saved character',async({page})=>{
  await setup(page);await page.goto('/profile.html');await expect(page.getByRole('link',{name:/Character Studio/})).toHaveAttribute('href','avatars.html');await expect(page.locator('#profileAvatar img[alt="Cyber Starter"]')).toHaveAttribute('src',/cosmetic-cyber-starter.svg$/);
});
test('Existing World Ranks opens a cosmetic player card from avatar and username',async({page})=>{
  await setup(page);await page.goto('/leaderboards.html');await page.locator('.leader-avatar[data-username="PlayerOne"]').click();await expect(page.locator('.cosmetic-player-dialog')).toBeVisible();await expect(page.locator('#cosmetic-player-name')).toHaveText('@PlayerOne');await page.keyboard.press('Escape');await page.locator('.leader-profile-link[data-username="PlayerOne"]').click();await expect(page.locator('.cosmetic-player-dialog')).toBeVisible();
});

test('Free beards, shoes, backpacks and glasses save independently without spending Coins',async({page})=>{
  test.setTimeout(60000);
  const f=await setup(page);await page.goto('/avatars.html');await expect(page.locator('#coin-balance')).toHaveText('1,250');
  for (const [tab,name,slot] of [['Beards','Explorer Beard','beard'],['Shoes','Canvas Sneakers','shoes'],['Backpacks','Canvas Backpack','backpack'],['Facewear','Round Glasses','face']]){
    await page.getByRole('button',{name:tab,exact:true}).click();await page.getByRole('button',{name:'Equip '+name,exact:true}).click();await expect(page.getByRole('button',{name:'Equipped '+name,exact:true})).toBeDisabled();
    await expect(page.locator('#character-stage img[alt="'+name+'"]')).toBeVisible();expect(f.user().equipped[slot].name).toBe(name);
  }
  await expect(page.locator('#coin-balance')).toHaveText('1,250');expect(f.keys).toHaveLength(0);
  await expect(page.locator('#nav-avatar img')).toHaveCount(8);
  expect(await page.locator('#nav-avatar img').last().evaluate(img=>getComputedStyle(img).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await page.reload();await expect(page.locator('#character-stage img[alt="Explorer Beard"]')).toBeVisible();
  await page.getByRole('button',{name:'View my profile'}).click();await expect(page.locator('#modal-character img')).toHaveCount(8);await expect(page.locator('#modal-loadout')).toContainText('Canvas Backpack');
});
test('Trying on paid shoes does not change saved equipment or wallet; free filter hides paid choices',async({page})=>{
  const f=await setup(page);await page.goto('/avatars.html');await expect(page.locator('#coin-balance')).toHaveText('1,250');
  await page.getByRole('button',{name:'Shoes',exact:true}).click();await page.getByRole('button',{name:'Preview Neon Kicks',exact:true}).click();
  await expect(page.locator('#character-stage img[alt="Neon Kicks"]')).toBeVisible();await expect(page.locator('#preview-note')).toContainText('Preview only');expect(f.user().equipped.shoes.id).toBe('trail-boots');expect(f.keys).toHaveLength(0);
  await page.getByRole('button',{name:'Reset preview'}).click();await expect(page.locator('#character-stage img[alt="Trail Boots"]')).toBeVisible();
  await page.getByLabel('Free options only').check();await expect(page.getByRole('button',{name:'Buy Neon Kicks',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Equip Canvas Sneakers',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('Guests can try on accessories without signing in or buying',async({page})=>{
  await setup(page,{signedIn:false});await page.goto('/avatars.html');await expect(page.locator('#nav-name')).toHaveText('Guest');
  await page.getByRole('button',{name:'Beards',exact:true}).click();await page.getByRole('button',{name:'Preview Short Beard',exact:true}).click();await expect(page.locator('#character-stage img[alt="Short Beard"]')).toBeVisible();await expect(page.locator('#auth-modal')).not.toBeVisible();
});

// Blank accessory layers must remain transparent, and the full rig must fit cards.
test('Layered leaderboard portraits stay visible and shop cards contain the whole character',async({page})=>{
  await setup(page);await page.goto('/avatars.html');
  await expect(page.locator('#leaderboard-body .character img')).toHaveCount(8);
  const portrait=await page.locator('#leaderboard-body .character img').evaluateAll(imgs=>imgs.map(img=>({background:getComputedStyle(img).backgroundColor,fit:getComputedStyle(img).objectFit})));
  for(const layer of portrait){expect(layer.background).toBe('rgba(0, 0, 0, 0)');expect(layer.fit).toBe('contain');}
  for(const tab of ['Avatars','Outfits','Shoes','Beards']){
    await page.getByRole('button',{name:tab,exact:true}).click();
    const bounds=await page.locator('.item-art .character').evaluateAll(chars=>chars.map(c=>{const a=c.parentElement.getBoundingClientRect(),r=c.getBoundingClientRect();return {inside:r.top>=a.top-.5&&r.bottom<=a.bottom+.5&&r.left>=a.left-.5&&r.right<=a.right+.5};}));
    expect(bounds.length).toBeGreaterThan(0);for(const box of bounds)expect(box.inside).toBeTruthy();
  }
});

test('Headwear, search, ownership filters and fit inspection work without spending',async({page})=>{
  const f=await setup(page);await page.goto('/avatars.html');await expect(page.locator('#nav-name')).toHaveText('@PlayerOne');
  await page.getByRole('button',{name:'Headwear',exact:true}).click();await page.getByRole('button',{name:'Preview Comms Headset',exact:true}).click();
  await expect(page.locator('#character-stage img[alt="Comms Headset"]')).toBeVisible();await expect(page.locator('#nav-avatar img[alt="No Headwear"]')).toHaveCount(1);
  await page.getByLabel('Find your next piece').fill('beanie');await expect(page.locator('.item-card')).toHaveCount(1);await expect(page.locator('.item-card')).toContainText('Ribbed Beanie');
  await page.getByLabel('Find your next piece').fill('');await page.getByLabel('My collection').check();await expect(page.locator('.item-card')).toHaveCount(3);
  await page.getByRole('button',{name:'Footwear',exact:true}).click();await expect(page.locator('#character-stage')).toHaveAttribute('data-focus','shoes');
  await page.getByRole('button',{name:'Full look',exact:true}).click();await expect(page.locator('#character-stage')).toHaveAttribute('data-focus','full');expect(f.keys).toHaveLength(0);
});
test('Coin packs show approved prices and fail closed before merchant setup',async({page})=>{
  await setup(page);await page.route('**/coin-shop/config',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({available:false,packs:[{id:'starter',coins:500,priceCents:199},{id:'plus',coins:1500,priceCents:499},{id:'vault',coins:4000,priceCents:999}]})}));
  await page.goto('/avatars.html');await expect(page.locator('#coin-packs article')).toHaveCount(3);await expect(page.locator('#coin-status')).toContainText('coming soon');
  for(const button of await page.locator('#coin-packs button').all())await expect(button).toBeDisabled();await expect(page.locator('#coin-packs')).toContainText('$9.99');
});
