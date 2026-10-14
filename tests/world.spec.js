const {test,expect}=require('@playwright/test');
test('World preview fits narrow screens and exposes catalog without enabling purchases',async({page})=>{
 await page.route('**/cloud.js',route=>route.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>null};'}));
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:320,height:740});await page.goto('/world.html');
 await expect(page.locator('#panelTitle')).toHaveText('Join Earnly World');
 await expect(page.getByRole('link',{name:'Sign in',exact:true})).toHaveAttribute('href','account.html');
 await page.getByRole('button',{name:'Close panel'}).click();
 await expect(page.locator('#connectionStatus')).toContainText('Sign in');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
 await page.getByRole('button',{name:'Catalog',exact:false}).click();
 await expect(page.locator('.item-card')).toHaveCount(22);
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
 await page.goto('/world.html');
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

test('Owned furniture double-taps lift and drop while invalid tiles and cancellation preserve it',async({page,isMobile})=>{
 const fs=require('node:fs');
 await page.route('**/world-renderer.js',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync('world-renderer.js','utf8')+';{const Base=EarnlyWorldRenderer.WorldRenderer;EarnlyWorldRenderer.WorldRenderer=class extends Base{constructor(...a){super(...a);window.testRenderer=this;}};}'}));
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.route('https://*.supabase.co/**',r=>r.fulfill({status:404,body:''}));
 await page.addInitScript(()=>{
  const item={id:'owned-chair',name:'Arcade Chair',sprite:'chair',x:3,y:3,z:0,width:1,length:1,rotation:0,itemHeight:1,walkable:false,canStack:false,canSit:true,canLay:false};
  const scene={roomId:'my-room',name:'My room',ownerId:'owner',heightmap:Array(8).fill('00000000').join('\n'),items:[item]};
  const bootstrap={items:[{id:item.id}],catalog:[],rooms:[],friends:[],balance:0};window.savedDrops=[];
  window.WebSocket=class{
   static OPEN=1;
   constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),10);}
   send(raw){const p=JSON.parse(raw),emit=x=>this.onmessage?.({data:JSON.stringify(x)});
    if(p.type==='JOIN'){emit({type:'WELCOME',userId:'owner',scene,bootstrap});emit({type:'ROOM_SNAPSHOT',users:[]});}
    if(p.type==='ACTION'){
     if(p.action==='place'){window.savedDrops.push(p.data);Object.assign(item,p.data);emit({type:'SCENE',scene});}
     emit({type:'RESULT',requestId:p.requestId,data:p.action==='bootstrap'?bootstrap:{}});
    }
   }
  };
 });
 await page.goto('/world.html');await expect(page.locator('#connectionStatus')).toContainText('Live');
 const point=()=>page.evaluate(()=>{const r=window.testRenderer,i=r.scene.items[0],b=r.canvas.getBoundingClientRect();return {x:b.left+r.cx+(i.x-i.y)*18*r.scale,y:b.top+r.cy+((i.x+i.y)*9-6)*r.scale};});
 const double=async p=>{if(isMobile){await page.touchscreen.tap(p.x,p.y);await page.touchscreen.tap(p.x,p.y);}else await page.mouse.dblclick(p.x,p.y);};
 const distance=await page.evaluate(()=>144*window.testRenderer.scale);
 let p=await point();await double(p);await expect(page.locator('#placementInstructions')).toContainText('Double-tap to drop');
 await expect.poll(()=>page.evaluate(()=>window.testRenderer.placement?.valid)).toBe(true);
 // The same pointer stream handles mouse and touch dragging; real touch pickup/drop is above.
 await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x-distance,p.y,{steps:5});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>window.testRenderer.placement.valid)).toBe(false);
 await double({x:p.x-distance,y:p.y});expect(await page.evaluate(()=>window.savedDrops.length)).toBe(0);
 await page.mouse.move(p.x-distance,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y+20,{steps:5});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>window.testRenderer.placement.valid)).toBe(true);
 expect(await page.evaluate(()=>window.savedDrops.length)).toBe(0);await double({x:p.x,y:p.y+20});
 await expect.poll(()=>page.evaluate(()=>window.savedDrops.length)).toBe(1);
 await expect(page.locator('#placementHint')).not.toBeVisible();
 p=await point();await double(p);await page.locator('#cancelPlace').click();
 expect(await page.evaluate(()=>window.savedDrops.length)).toBe(1);
 // A visitor cannot enter editing even if they can see the furniture.
 await page.evaluate(()=>{window.testRenderer.scene.ownerId='someone-else';});
 p=await point();await double(p);await expect(page.locator('#placementHint')).not.toBeVisible();
});
