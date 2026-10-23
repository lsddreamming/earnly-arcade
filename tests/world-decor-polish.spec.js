const {test,expect}=require('@playwright/test');
const extras=[['marble-column','column','#e3d8bc'],['woven-divider','divider','#b89b69',2],['low-table','table','#e1b786'],['walnut-table','walnut-nesting','#aa8069'],['oak-bookshelf','bookshelf','#b88c66'],['sage-chair','sage-slatted','#91bb96'],['flower-pot','flowers','#eab2ed'],['cloud-bed','bed','#8cbbf4',1,2],['star-trophy','trophy','#f8d46a']].map(([id,sprite_id,color,width=1,length=1])=>({id,name:id,sprite_id,color,width,length}));
extras.push(...['dog','cat','rabbit'].map(species=>({id:'bed-'+species,name:species+' bed',sprite_id:'pet-bed-'+species,width:1,length:1,color:'#a493c4'})));
test.beforeEach(async({page})=>{await page.addInitScript(items=>window.decorReviewExtras=items,extras);await page.route('https://**',r=>r.abort());await page.goto('/world.html?catalog=Halloween');});
test('Polished screenshot collection has unique, unclipped, recolorable four-way artwork',async({page})=>{
 const report=await page.evaluate(()=>{
  const items=[...EarnlyWorldCollections.allItems,...window.decorReviewExtras].filter(i=>EarnlyDecorPolish.has(i.sprite_id)),errors=[],unique=new Set();
  const render=(i,r,color)=>{const canvas=document.createElement('canvas');EarnlyWorldRenderer.thumbnail(canvas,{...i,rotation:r,color});const p=canvas.getContext('2d').getImageData(0,0,160,128).data;let pixels=0;for(let y=0;y<128;y++)for(let x=0;x<160;x++)if(p[(y*160+x)*4+3]){pixels++;if(!x||!y||x===159||y===127)errors.push(i.id+' clipped '+r);}if(pixels<100)errors.push(i.id+' empty');return canvas.toDataURL();};
  for(const i of items){const views=[0,2,4,6].map(r=>render(i,r,i.color));unique.add(views.join('|'));if(views.every((v,k)=>v===render(i,k*2,'#d88fb8')))errors.push(i.id+' ignores color');}
  return {count:items.length,unique:unique.size,errors};
 });expect(report.errors).toEqual([]);expect(report.count).toBe(104);expect(report.unique).toBe(104);
});
test('Selected effects change over time in all four rotations without changing item data',async({page})=>{
 const result=await page.evaluate(()=>{
  const items=[...EarnlyWorldCollections.allItems,...window.decorReviewExtras].filter(i=>EarnlyDecorPolish.isAnimated(i.sprite_id)),before=JSON.stringify(items),errors=[];
  for(const item of items)for(const rotation of [0,2,4,6]){const canvas=document.createElement('canvas');canvas.width=160;canvas.height=128;const c=canvas.getContext('2d');const draw=t=>{c.clearRect(0,0,160,128);EarnlyDecorPolish.effects(c,{...item,rotation},80,75,t);return canvas.toDataURL();};if(draw(0)===draw(650))errors.push(item.id+' frozen '+rotation);}
  return {count:items.length,errors,unchanged:before===JSON.stringify(items)};
 });expect(result).toEqual({count:20,errors:[],unchanged:true});
});
test('Visible previews animate, reduced motion stops them, and removed previews release their scheduler',async({page})=>{
 await page.evaluate(()=>{document.body.replaceChildren();const c=document.createElement('canvas');c.id='motion';document.body.append(c);EarnlyWorldRenderer.thumbnail(c,EarnlyWorldCollections.allItems.find(i=>i.id==='halloween-cauldron'));});
 const snapshot=()=>page.locator('#motion').evaluate(c=>c.toDataURL());const before=await snapshot();await expect.poll(snapshot).not.toBe(before);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(120);const frozen=await snapshot();await page.waitForTimeout(250);expect(await snapshot()).toBe(frozen);
 await page.emulateMedia({reducedMotion:'no-preference'});await expect.poll(snapshot).not.toBe(frozen);
 await page.evaluate(()=>{window.removed=document.querySelector('#motion');removed.remove();});await page.waitForTimeout(120);const old=await page.evaluate(()=>removed.toDataURL());await page.waitForTimeout(200);expect(await page.evaluate(()=>removed.toDataURL())).toBe(old);
});
test('Generate review sheet at catalog scale',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{document.body.replaceChildren();document.body.style.cssText='margin:0;background:#142b3d;color:#e7eee8;font:13px system-ui;display:grid;grid-template-columns:repeat(5,180px);gap:8px;padding:12px;overflow:auto;height:auto';for(const item of [...EarnlyWorldCollections.allItems,...window.decorReviewExtras].filter(i=>EarnlyDecorPolish.has(i.sprite_id))){const card=document.createElement('div');card.style.cssText='background:#203d4d;padding:8px;border-radius:12px;text-align:center';const c=document.createElement('canvas');EarnlyWorldRenderer.thumbnail(c,item);card.append(c,document.createTextNode(item.name));document.body.append(card);}});
 await page.setViewportSize({width:960,height:1500});await page.screenshot({path:'test-results/decor-polish-sheet.png',fullPage:true});
});
test('Room effects reuse cached geometry and keep a bounded per-frame budget',async({page})=>{
 const result=await page.evaluate(()=>{
  const choices=EarnlyWorldCollections.allItems.filter(i=>EarnlyDecorPolish.isAnimated(i.sprite_id));
  const items=Array.from({length:30},(_,i)=>{const item=choices[i%choices.length];return {...item,id:'effect-'+i,sprite:item.sprite_id,x:2,y:2,z:0};});
  const canvas=document.createElement('canvas'),map='000000\n000000\n000000\n000000\n000000\n000000';
  EarnlyWorldRenderer.roomThumbnail(canvas,map,items);
  const create=document.createElement.bind(document),effect=EarnlyDecorPolish.effects;let canvases=0,calls=0;
  document.createElement=(name,...args)=>{if(name==='canvas')canvases++;return create(name,...args);};EarnlyDecorPolish.effects=(...args)=>{calls++;return effect(...args);};
  try{for(let j=0;j<10;j++)EarnlyWorldRenderer.roomThumbnail(canvas,map,items);}finally{document.createElement=create;EarnlyDecorPolish.effects=effect;}
  return {canvases,calls};
 });expect(result.canvases).toBe(0);expect(result.calls).toBe(240);
});
test('Guest furniture previews show the rebalanced prices before sign-in',async({page})=>{
 await page.goto('/world.html?catalog=Bathroom');
 const hamper=page.locator('.item-card').filter({hasText:'Woven Laundry Hamper'});
 await expect(hamper).toContainText('200');
 await expect(page.locator('.item-card').filter({hasText:'Soaking Bathtub'})).toContainText('850');
 const result=await page.evaluate(()=>({hamper:EarnlyFurniturePrices['bath-hamper'],waterfall:EarnlyFurniturePrices.waterfall,pavilion:EarnlyFurniturePrices['aurora-pavilion']}));
 expect(result).toEqual({hamper:200,waterfall:1375,pavilion:10000});
});
test('A changed price refreshes the confirmation and waits for another explicit Buy',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{
  window.priceAttempts=[];
  window.WebSocket=class{
   static OPEN=1;constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),10);}close(){}
   send(raw){const p=JSON.parse(raw),emit=data=>this.onmessage?.({data:JSON.stringify(data)});this.bootstrap??={balance:1000,rooms:[],catalog:[{id:'bath-hamper',name:'Woven Laundry Hamper',sprite_id:'bath-hamper',price:65,color:'#80c9b5',width:1,length:1}],items:[],friends:[]};
    if(p.type==='JOIN')emit({type:'WELCOME',userId:'price-owner',scene:{roomId:'home',ownerId:'price-owner',name:'Home',heightmap:'0000\n0000\n0000\n0000',items:[]},bootstrap:this.bootstrap});
    if(p.type==='ACTION'){
     if(p.action==='buy'){
      window.priceAttempts.push(p.data);if(window.priceAttempts.length===1){this.bootstrap.catalog[0].price=200;emit({type:'RESULT',requestId:p.requestId,error:'Price changed. Reopen the catalog to confirm the current price.',definite:true});return;}
      this.bootstrap.balance-=200;this.bootstrap.items.push({id:'owned-hamper',definition_id:'bath-hamper',serial:1});
     }
     emit({type:'RESULT',requestId:p.requestId,data:p.action==='bootstrap'?this.bootstrap:{}});
    }
   }
  };
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#connectionStatus')).toContainText('Live');
 await page.locator('[data-panel="catalog"]').click();await page.getByRole('button',{name:'◇ 65 · Buy',exact:true}).click();await page.getByRole('button',{name:'Buy for ◇ 65',exact:true}).click();
 await expect(page.getByRole('button',{name:'Buy for ◇ 200',exact:true})).toBeVisible();await expect(page.locator('#coinBalance')).toHaveText('◇ 1,000');
 expect(await page.evaluate(()=>window.priceAttempts.length)).toBe(1);
 await page.getByRole('button',{name:'Buy for ◇ 200',exact:true}).click();await expect(page.locator('#coinBalance')).toHaveText('◇ 800');
 const attempts=await page.evaluate(()=>window.priceAttempts);expect(attempts.map(p=>p.expectedPrice)).toEqual([65,200]);expect(attempts[0].requestId).not.toBe(attempts[1].requestId);
});

test('Budget shopping filters unavailable pieces and preserves the filter after preview and purchase',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{
  window.budgetBuys=[];
  window.WebSocket=class{
   static OPEN=1;constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),10);}close(){}
   send(raw){const p=JSON.parse(raw),emit=data=>this.onmessage?.({data:JSON.stringify(data)});this.bootstrap??={balance:200,rooms:[],catalog:[
    {id:'affordable',name:'Budget Hamper',price:200}, {id:'expensive',name:'Luxury Hamper',price:850},
    {id:'gift',name:'VIP Hamper',price:0,vip_only:true},{id:'sold',name:'Sold Hamper',price:125,supply_limit:1,minted:1}
   ].map(d=>({...d,category:'Bathroom',sprite_id:'bath-hamper',color:'#80c9b5',width:1,length:1})),items:[],friends:[]};
    if(p.type==='JOIN')emit({type:'WELCOME',userId:'budget-owner',scene:{roomId:'home',ownerId:'budget-owner',name:'Home',heightmap:'0000\n0000\n0000\n0000',items:[]},bootstrap:this.bootstrap});
    if(p.type==='ACTION'){
     if(p.action==='buy'){if(!window.budgetBuys.some(b=>b.requestId===p.data.requestId)){this.bootstrap.balance-=200;this.bootstrap.items.push({id:'owned-budget',definition_id:'affordable',serial:1});}window.budgetBuys.push(p.data);}
     emit({type:'RESULT',requestId:p.requestId,data:p.action==='bootstrap'?this.bootstrap:{}});
    }
   }
  };
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#connectionStatus')).toContainText('Live');
 await page.locator('[data-panel="catalog"]').click();await page.locator('.catalog-refine summary').click();
 await page.getByRole('button',{name:'Within my budget',exact:true}).click();await expect(page.locator('.item-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Preview Budget Hamper',exact:true}).click();await page.getByRole('button',{name:'Back to catalog',exact:true}).click();
 await expect(page.getByRole('button',{name:'Within my budget',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'◇ 200 · Buy',exact:true}).click();await expect(page.locator('#panelContent')).toContainText('After purchase: 0 Arcade Coins');
 await page.getByRole('button',{name:'Buy for ◇ 200',exact:true}).click();await expect(page.locator('.item-card')).toHaveCount(0);await expect(page.locator('#panelContent')).toContainText('No available pieces match your budget');
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.locator('.item-card')).toHaveCount(4);
 await page.getByRole('button',{name:'◇ 850 · Buy',exact:true}).click();await expect(page.locator('#panelContent')).toContainText('You need 850 more Arcade Coins.');await expect(page.getByRole('button',{name:'Buy for ◇ 850',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.budgetBuys.length)).toBe(1);
 await page.getByRole('button',{name:'Back to catalog',exact:true}).click();
 await page.evaluate(()=>localStorage.setItem('earnlyWorldPendingPurchase:budget-owner',JSON.stringify(window.budgetBuys[0])));
 await page.getByRole('button',{name:'◇ 200 · Buy another',exact:true}).click();
 await expect(page.getByRole('button',{name:'Buy for ◇ 200',exact:true})).toBeEnabled();
 await expect(page.locator('#panelContent')).not.toContainText('You need');
 await page.getByRole('button',{name:'Buy for ◇ 200',exact:true}).click();await expect(page.locator('#coinBalance')).toHaveText('◇ 0');
 expect(await page.evaluate(()=>window.budgetBuys.length)).toBe(2);
});

test('Cafe catalog keeps controls compact and card actions reachable on narrow phones',async({page},info)=>{
 for(const width of [320,430]){
  await page.setViewportSize({width,height:932});await page.goto('/world.html?catalog='+encodeURIComponent('Roast & Gather'));
  await expect(page.locator('.item-card')).toHaveCount(16);
  await page.locator('.catalog-refine summary').click();
  expect(await page.locator('#worldPanel').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  const card=page.locator('.item-card').first();await card.scrollIntoViewIfNeeded();
  const save=card.locator('.wishlist-save');const box=await save.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  await save.click();await expect(save).toHaveAttribute('aria-pressed','true');await save.click();
  expect((await card.boundingBox()).height).toBeLessThan(270);
  await page.screenshot({path:info.outputPath('cafe-catalog-'+width+'.png')});
 }
});
test('Review the sculpted cafe collection and distinct pet beds at preview scale',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{document.body.replaceChildren();document.body.style.cssText='margin:0;background:#142b3d;color:#e7eee8;font:13px system-ui;display:grid;grid-template-columns:repeat(4,190px);gap:8px;padding:12px;overflow:auto;height:auto';for(const item of [...EarnlyWorldCollections.allItems.filter(i=>i.category==='Roast & Gather'),...window.decorReviewExtras.filter(i=>i.sprite_id.startsWith('pet-bed-'))]){const card=document.createElement('div');card.style.cssText='background:#203d4d;padding:8px;border-radius:12px;text-align:center';const c=document.createElement('canvas');EarnlyWorldRenderer.thumbnail(c,item);card.append(c,document.createTextNode(item.name));document.body.append(card);}});
 await page.setViewportSize({width:820,height:900});await page.screenshot({path:info.outputPath('cafe-beds-review.png'),fullPage:true});
});
