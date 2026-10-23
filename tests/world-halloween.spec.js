const {test,expect}=require('@playwright/test');
test('Original seasonal and household models render distinctly in all directions',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-22T12:00:00Z'));
 await page.route('https://**',r=>r.abort());await page.goto('/world.html?catalog=Halloween');
 await expect(page.locator('#panelContent')).toContainText('Lantern Grin Pumpkin');
 const result=await page.evaluate(()=>{
  const problems=[],art=new Set(),items=[...EarnlyWorldCollections.halloweenItems,...EarnlyWorldCollections.householdItems];
  const render=(item,rotation,color)=>{const c=document.createElement('canvas');EarnlyWorldRenderer.thumbnail(c,{...item,rotation,color});const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0,edge=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]){count++;if(!x||!y||x===c.width-1||y===c.height-1)edge++;}if(count<50||edge)problems.push(item.id+' clipped/empty '+rotation);return c.toDataURL();};
  for(const item of items){const views=[0,2,4,6].map(r=>render(item,r,item.color));if(views.every((v,i)=>v===render(item,i*2,'#d9a0b5')))problems.push(item.id+' color');art.add(views.join('|'));}
  return {count:items.length,unique:art.size,problems};
 });expect(result).toEqual({count:11,unique:11,problems:[]});
 await page.screenshot({path:'test-results/halloween-catalog.png',fullPage:true});
});

test('Seasonal offers disappear at UTC close and return next October; household remains',async({page})=>{
 await page.route('https://**',r=>r.abort());
 for(const [at,visible]of [['2026-09-30T23:59:59Z',false],['2026-10-01T00:00:00Z',true],['2026-11-02T23:59:59Z',true],['2026-11-03T00:00:00Z',false],['2027-10-01T00:00:00Z',true]]){
  await page.clock.setFixedTime(new Date(at));await page.goto('/world.html?catalog=Halloween');
  await expect(page.locator('.catalog-grid .item-card')).toHaveCount(visible?9:0);
  await expect(page.getByRole('button',{name:'Halloween',exact:true})).toHaveCount(visible?1:0);
  await page.getByRole('button',{name:'Home Essentials',exact:true}).click();
  await expect(page.locator('.catalog-grid')).toContainText('Retro Desktop Computer');
  await expect(page.locator('.catalog-grid')).toContainText('Medicine Cabinet');
 }
});

test('Off-season owned decorations stay in Backpack and a previous purchase can be confirmed',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-03T00:00:00Z'));
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{
  localStorage.setItem('earnlyWorldPendingPurchase:u',JSON.stringify({definitionId:'halloween-lantern',requestId:'receipt-1',color:null}));
  window.WebSocket=class extends EventTarget{
   static OPEN=1;constructor(){super();this.readyState=1;setTimeout(()=>this.onopen?.(),10);}close(){}
   emit(p){this.onmessage?.({data:JSON.stringify(p)});}
   send(raw){const p=JSON.parse(raw);if(p.type==='JOIN'){
    const catalog=[...EarnlyWorldCollections.halloweenItems,...EarnlyWorldCollections.householdItems].map(d=>({...d,shop_available:!d.season}));
    const items=[{id:'owned-pumpkin',definition_id:'halloween-lantern',room_id:null,color:null}];
    this.emit({type:'WELCOME',userId:'u',scene:{roomId:'r',ownerId:'u',name:'Autumn Room',heightmap:'00000\n00000\n00000\n00000',items:[]},bootstrap:{balance:2000,rooms:[],items,catalog,friends:[]}});
    this.emit({type:'ROOM_SNAPSHOT',users:[{userId:'u',username:'Tester',position:{x:1,y:2,z:0},state:'std'}]});
   }}
  };
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#worldConnected')).toBeVisible();
 await page.locator('[data-panel="catalog"]').click();
 await expect(page.locator('.catalog-grid')).not.toContainText('Lantern Grin Pumpkin');
 await page.getByRole('button',{name:'Confirm previous purchase',exact:true}).click();
 await expect(page.locator('#panelContent')).toContainText('Confirming your previous purchase');
 await page.getByRole('button',{name:'Back to catalog',exact:true}).click();
 await page.getByRole('button',{name:'View Backpack',exact:true}).click();
 await expect(page.locator('#panelContent')).toContainText('Lantern Grin Pumpkin');
 await expect(page.locator('#panelContent').getByRole('button',{name:/Place/}).first()).toBeEnabled();
});
