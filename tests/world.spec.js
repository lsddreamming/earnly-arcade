const {test,expect}=require('@playwright/test');
// World fixtures use local assets and mocked auth; avoid remote font/layout races.
test.beforeEach(async({page})=>{await page.route('https://**',route=>route.abort());});
test('World starts at Connect without a plaza or an automatic connection',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>null};'}));
 await page.addInitScript(()=>{window.socketCount=0;window.WebSocket=class{constructor(){window.socketCount++;}};});
 await page.setViewportSize({width:320,height:740});await page.goto('/world.html');
 await expect(page.locator('#connectWorld')).toBeVisible();await expect(page.locator('#worldConnected')).toBeHidden();
 expect(await page.evaluate(()=>window.socketCount)).toBe(0);
 await page.locator('#connectWorld').click();await expect(page.locator('#panelTitle')).toHaveText('Join Earnly World');
 await page.getByRole('button',{name:'Close panel'}).click();await expect(page.locator('#worldSignIn')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('First-room selection survives a lost close code and enters the chosen room without retrying',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{
  window.worldJoins=[];
  window.WebSocket=class{
   static OPEN=1;
   constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),10);}
   close(){this.readyState=3;setTimeout(()=>this.onclose?.({code:1006,reason:''}),10);}
   send(raw){const p=JSON.parse(raw);if(p.type!=='JOIN')return;window.worldJoins.push(p.roomId);
    if(p.roomId==='choose-home'){this.onmessage?.({data:JSON.stringify({type:'ROOM_CHOICE_REQUIRED'})});if(this.readyState!==3)this.close();}
    else this.onmessage?.({data:JSON.stringify({type:'WELCOME',userId:'owner',scene:{roomId:'new-room',name:'My Room',ownerId:'owner',heightmap:'0000\n0000\n0000\n0000',items:[]},bootstrap:{balance:0,rooms:[],catalog:[],items:[],friends:[]}})});
   }
  };
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();
 await expect(page.locator('#panelTitle')).toHaveText('Choose your first room');
 await expect(page.locator('#entryStatus')).toContainText('it is free');
 await page.getByRole('button',{name:'Close panel',exact:true}).click();
 await page.locator('#connectWorld').click();
 await expect(page.locator('#panelTitle')).toHaveText('Choose your first room');
 expect(await page.evaluate(()=>window.worldJoins)).toEqual(['choose-home']);
 await page.getByRole('button',{name:'Wide Loft',exact:true}).click();
 await page.getByRole('button',{name:'Start in Wide Loft',exact:true}).click();
 await expect(page.locator('#connectionStatus')).toContainText('Live');
 await expect(page.locator('#worldPanel')).not.toBeVisible();
 await page.waitForTimeout(1700); // Pass the former automatic retry boundary.
 expect(await page.evaluate(()=>window.worldJoins)).toEqual(['choose-home','starter-loft']);
 await expect(page.locator('#connectionStatus')).toContainText('Live');
});

test('World reports server configuration failure without asking players to sign in again',async({page})=>{
 await page.route('**/activity.js',r=>r.fulfill({contentType:'application/javascript',body:'window.activityEvents=[];window.EarnlyActivity={track:k=>window.activityEvents.push(k)};'}));
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
 await page.goto('/world.html');await page.locator('#connectWorld').click();
 await expect(page.locator('#connectWorld')).toBeDisabled();
 await expect(page.locator('#connectionStatus')).toContainText('Connecting');
 await page.locator('#connectWorld').evaluate(button=>button.click());
 expect(await page.evaluate(()=>window.worldSockets.length)).toBe(1);
 await page.evaluate(()=>{window.worldSockets[0].failConfig();window.worldSockets[0].failConfig();});
 expect(await page.evaluate(()=>window.activityEvents)).toEqual(['world_attempt','world_failure']);
 await expect(page.locator('#connectionStatus')).toContainText('Server setup needs attention');
 await expect(page.locator('#connectionStatus')).not.toContainText('Sign in');
 await expect(page.locator('#peopleCount')).toHaveText('Room preview');
 await expect(page.locator('#connectWorld')).toBeEnabled();
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
  const bootstrap={items:[{id:item.id}],catalog:[],rooms:[],friends:[],balance:0};window.savedDrops=[];window.seatRequests=[];
  window.WebSocket=class{
   static OPEN=1;
   constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),10);}
   send(raw){const p=JSON.parse(raw),emit=x=>this.onmessage?.({data:JSON.stringify(x)});
    if(p.type==='JOIN'){emit({type:'WELCOME',userId:'owner',scene,bootstrap});emit({type:'ROOM_SNAPSHOT',users:[]});}
    if(p.type==='INTERACT')window.seatRequests.push(p);
    if(p.type==='ACTION'){
     if(p.action==='place'){window.savedDrops.push(p.data);Object.assign(item,p.data);emit({type:'SCENE',scene});}
     emit({type:'RESULT',requestId:p.requestId,data:p.action==='bootstrap'?bootstrap:{}});
    }
   }
  };
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#worldEntry')).toBeHidden();await expect(page.locator('#connectionStatus')).toContainText('Live');
 // Connection reveals the canvas; wait for its resize and first visible render before projecting pointer coordinates.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect.poll(()=>page.evaluate(()=>window.testRenderer.width)).toBeGreaterThan(0);
 const point=()=>page.evaluate(()=>{const r=window.testRenderer,i=r.scene.items[0],b=r.canvas.getBoundingClientRect();return {x:b.left+r.cx+(i.x-i.y)*18*r.scale,y:b.top+r.cy+((i.x+i.y)*9-6)*r.scale};});
 const double=async p=>{if(isMobile){await page.touchscreen.tap(p.x,p.y);await page.touchscreen.tap(p.x,p.y);}else await page.mouse.dblclick(p.x,p.y);};
 const distance=await page.evaluate(()=>144*window.testRenderer.scale);
 let p=await point();
 if(isMobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
 await expect.poll(()=>page.evaluate(()=>window.seatRequests.length)).toBe(1);
 await expect(page.locator('#worldPanel')).not.toBeVisible();
 await double(p);await expect(page.locator('#placementInstructions')).toContainText('Double-tap to drop');
 expect(await page.evaluate(()=>window.seatRequests.length)).toBe(1);
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

test('Large rooms open close to your character, with overview, recentering and stable furniture refreshes',async({page},testInfo)=>{
 test.setTimeout(60000);
 const fs=require('node:fs');
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>null};'}));
 await page.route('**/world-renderer.js',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync('world-renderer.js','utf8')+';{const Base=EarnlyWorldRenderer.WorldRenderer;EarnlyWorldRenderer.WorldRenderer=class extends Base{constructor(...a){super(...a);window.testRenderer=this;}};}'}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});await page.goto('/world.html');await page.evaluate(()=>{document.getElementById('worldEntry').hidden=true;document.getElementById('worldConnected').hidden=false;});
 await page.evaluate(()=>{
  const r=window.testRenderer;r.localUserId='preview';r.resize();
  r.setScene({...r.scene,roomId:'large-lobby',theme:'lobby',heightmap:Array(24).fill('0'.repeat(24)).join('\n'),items:[]});
  r.updateUser({userId:'preview',username:'Your potato',position:{x:8,y:8,z:0}});
  r.updateUser({userId:'friend',username:'Friend',position:{x:9,y:9,z:0},state:'sit'});
 });
 await expect.poll(()=>page.evaluate(()=>window.testRenderer.scale*48)).toBeGreaterThan(55);
 const closeScale=await page.evaluate(()=>window.testRenderer.scale);
 await page.locator('#roomView').click();await expect(page.locator('#roomView')).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>page.evaluate(()=>window.testRenderer.scale)).toBeLessThan(closeScale/2);
 await page.locator('#focusMe').click();await expect(page.locator('#roomView')).toHaveAttribute('aria-pressed','false');
 await page.evaluate(()=>{const r=window.testRenderer;r.offset={x:63,y:-22};r.setScene({...r.scene});});
 expect(await page.evaluate(()=>window.testRenderer.offset)).toEqual({x:63,y:-22});
 await page.locator('#focusMe').click();expect(await page.evaluate(()=>window.testRenderer.offset)).toEqual({x:0,y:0});
 await expect.poll(()=>page.evaluate(()=>window.testRenderer.scale)).toBe(closeScale);
 // Screen-to-floor coordinates must still work with a high-DPI backing canvas.
 const tile=await page.evaluate(()=>{const r=window.testRenderer,b=r.canvas.getBoundingClientRect();return {x:b.left+r.cx+(9-7)*18*r.scale,y:b.top+r.cy+((9+7)*9+9)*r.scale};});
 await page.evaluate(()=>{window.testRenderer.onTap=hit=>{window.floorHit=hit;};});await page.mouse.click(tile.x,tile.y);
 await expect.poll(()=>page.evaluate(()=>({x:window.floorHit?.x,y:window.floorHit?.y}))).toEqual({x:9,y:7});
 await page.evaluate(()=>{const r=window.testRenderer;r.updateUser({userId:'preview',position:{x:8,y:8,z:0},state:'std'});r.bubble({userId:'friend',text:'Welcome! Grab a seat and stay a while.'});});
 await page.waitForTimeout(300);
 for(const size of [{width:390,height:844},{width:320,height:740}]){
  await page.setViewportSize(size);
  await expect.poll(()=>page.evaluate(()=>window.testRenderer.width)).toBeLessThan(size.width);
  const rect=await page.locator('#sayForm').boundingBox(),nav=await page.locator('.world-bottom').boundingBox();
  expect(rect.y+rect.height).toBeLessThanOrEqual(nav.y);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  await page.screenshot({path:`test-results/world-close-${testInfo.project.name}-${size.width}.png`});
 }
 expect(errors).toEqual([]);
});

test('A stalled World connection times out and ignores late messages from the old socket',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.route('https://*.supabase.co/**',r=>r.fulfill({status:404,body:''}));
 await page.addInitScript(()=>{
  window.worldSockets=[];
  window.WebSocket=class{constructor(){this.readyState=0;window.worldSockets.push(this);}close(){this.readyState=3;this.onclose?.({code:1000});}};
 });
 await page.clock.install();await page.goto('/world.html');await page.locator('#connectWorld').click();
 await expect(page.locator('#connectWorld')).toBeDisabled();
 await page.clock.fastForward(75000);await expect(page.locator('#entryStatus')).toContainText('Reconnecting');
 await page.clock.fastForward(1500);await expect.poll(()=>page.evaluate(()=>window.worldSockets.length)).toBe(2);
 await page.evaluate(()=>window.worldSockets[0].onmessage?.({data:JSON.stringify({type:'WELCOME'})}));
 await expect(page.locator('#worldConnected')).toBeHidden();await expect(page.locator('#connectWorld')).toBeDisabled();
 await page.clock.fastForward(75000);await page.clock.fastForward(3000);
 await expect.poll(()=>page.evaluate(()=>window.worldSockets.length)).toBe(3);
 await page.clock.fastForward(75000);await expect(page.locator('#connectWorld')).toBeEnabled();
 await expect(page.locator('#entryStatus')).toContainText('timed out');
 await page.clock.fastForward(10000);expect(await page.evaluate(()=>window.worldSockets.length)).toBe(3);
});

test('Backpack search and room filters find stored and placed furniture without mutations',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.route('https://*.supabase.co/**',r=>r.fulfill({status:404,body:''}));
 await page.addInitScript(()=>{
  window.worldActions=[];
  window.WebSocket=class{constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),10);}send(raw){const p=JSON.parse(raw);if(p.type==='ACTION')window.worldActions.push(p);if(p.type==='JOIN')this.onmessage?.({data:JSON.stringify({type:'WELCOME',userId:'owner',scene:{roomId:'home',name:'Home',ownerId:'owner',heightmap:'0000\n0000\n0000\n0000',items:[]},bootstrap:{balance:100,rooms:[{id:'other',name:'Garden',ownerId:'owner'}],catalog:[{id:'chair',name:'Arcade Chair',sprite_id:'chair',color:'#799ff5',width:1,length:1},{id:'fern',name:'Moon Fern',sprite_id:'plant',color:'#64c786',width:1,length:1}],items:[{id:'a',definition_id:'chair',serial:1,room_id:null},{id:'b',definition_id:'fern',serial:2,room_id:'home'},{id:'c',definition_id:'chair',serial:3,room_id:'other'}],friends:[]}})});}};
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#worldEntry')).toBeHidden();await expect(page.locator('#connectionStatus')).toContainText('Live');await page.getByRole('button',{name:'Backpack',exact:false}).click();
 const cards=page.locator('.item-card:visible');await expect(cards).toHaveCount(3);
 await page.getByRole('searchbox',{name:'Find your furniture'}).fill('fern');await expect(cards).toHaveCount(1);
 await page.getByRole('combobox',{name:'Furniture location'}).selectOption('stored');await expect(cards).toHaveCount(0);await expect(page.locator('#panelContent')).toContainText('No furniture matches');
 await page.getByRole('searchbox').fill('');await expect(cards).toHaveCount(1);
 await page.getByRole('combobox').selectOption('elsewhere');await expect(cards).toHaveCount(1);await expect(page.getByRole('button',{name:'Visit Garden'})).toBeVisible();
 expect(await page.evaluate(()=>window.worldActions)).toEqual([]);
});

test('World iPhone view and furniture controls have comfortable touch targets',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>null};'}));
 await page.setViewportSize({width:320,height:740});await page.goto('/world.html');await page.evaluate(()=>{document.getElementById('worldEntry').hidden=true;document.getElementById('worldConnected').hidden=false;});
 await page.locator('#placementHint').evaluate(el=>el.hidden=false);
 for(const selector of ['#roomView','#focusMe','#zoomOut','#zoomIn','#rotateItem','#cancelPlace']){
  const box=await page.locator(selector).boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('World movement stays continuous through packet updates and stops at the authoritative tile',async({page})=>{
 await page.route('https://**',r=>r.abort());await page.goto('/world.html');
 const result=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');document.body.append(canvas);
  const r=new EarnlyWorldRenderer.WorldRenderer(canvas,()=>{});r.running=false;
  r.updateUser({userId:'walker',position:{x:1,y:1,z:0},state:'std',equipped:{head:{id:'hat'}}});
  r.updateUser({userId:'walker',position:{x:2,y:1,z:0},state:'wlk'});
  let u=r.users.get('walker');u.at=performance.now()-125;
  const before=r.sample(u);r.updateUser({userId:'walker',position:{x:3,y:1,z:0},state:'wlk'});u=r.users.get('walker');
  const jump=Math.abs(r.sample(u).x-before.x);const at=u.at;
  r.updateUser({userId:'walker',position:{x:3,y:1,z:0},state:'std'});u=r.users.get('walker');
  const preserved=u.at===at;u.at=performance.now()-300;r.animate(u,performance.now());
  for(let i=1;i<=60;i++)r.animate(u,performance.now()+i*17);
  return {jump,preserved,end:r.sample(u),gait:u.gait,hat:u.equipped.head.id,facing:u.facing};
 });
 expect(result.jump).toBeLessThan(.05);expect(result.preserved).toBe(true);expect(result.end).toEqual({x:3,y:1,z:0});expect(result.gait).toBeLessThan(.01);expect(result.hat).toBe('hat');expect(result.facing).toBe('right');
});

test('World pinch keeps the midpoint anchored, cancels taps and preserves furniture placement',async({page})=>{
 await page.route('https://**',r=>r.abort());await page.goto('/world.html');
 const result=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.style='width:390px;height:500px';document.body.append(canvas);
  const taps=[];const r=new EarnlyWorldRenderer.WorldRenderer(canvas,p=>taps.push(p));r.running=false;r.resize();
  r.setScene({roomId:'test',heightmap:Array(8).fill('00000000').join('\n'),items:[]});r.setView('room');r.draw();
  // Pointer capture is browser-owned; supply the same two touch pointer streams on both engines.
  canvas.setPointerCapture=()=>{};
  const box=canvas.getBoundingClientRect();const event=(type,id,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',button:0,clientX:box.left+x,clientY:box.top+y,bubbles:true}));
  const anchor={x:180,y:240},world={x:(anchor.x-r.cx)/r.scale,y:(anchor.y-r.cy)/r.scale};
  event('pointerdown',1,140,240);event('pointerdown',2,220,240);event('pointermove',1,100,240);event('pointermove',2,260,240);
  const zoomIn=r.zoom,error=Math.hypot(r.cx+world.x*r.scale-anchor.x,r.cy+world.y*r.scale-anchor.y);
  event('pointerup',2,260,240);event('pointerup',1,100,240);
  const placement={item:{width:1,length:1},x:3,y:3};r.placement=placement;r.draw=()=>{};
  event('pointerdown',3,100,240);event('pointerdown',4,260,240);event('pointermove',3,140,240);event('pointermove',4,220,240);event('pointercancel',3,140,240);event('pointerup',4,220,240);
  const zoomOut=r.zoom; r.setZoom(100);const max=r.zoom;r.setZoom(.01);const min=r.zoom;
  return {zoomIn,zoomOut,error,taps:taps.length,position:[placement.x,placement.y],locked:r.gestureLock,max,min};
 });
 expect(result.zoomIn).toBeGreaterThan(1);expect(result.zoomOut).toBeLessThan(result.zoomIn);expect(result.error).toBeLessThan(1);expect(result.taps).toBe(0);expect(result.position).toEqual([3,3]);expect(result.locked).toBe(false);expect(result.max).toBe(2.2);expect(result.min).toBe(.6);
});

test('Room deletion requires confirmation, protects other rooms, and leaves the deleted room',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{
  const rooms=[{id:'mine',name:'My Cozy Room',ownerId:'owner'},{id:'plaza',name:'Earnly Plaza',ownerId:null},{id:'other',name:'Friend Room',ownerId:'friend'}];
  const bootstrap={rooms,catalog:[],items:[],friends:[],balance:500};window.deletions=[];window.joins=[];
  window.WebSocket=class{
   static OPEN=1;
   constructor(){this.readyState=1;this.events={};setTimeout(()=>this.onopen?.(),10);}
   addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
   removeEventListener(name,fn){this.events[name]=(this.events[name]||[]).filter(f=>f!==fn);}
   close(){this.readyState=3;setTimeout(()=>{this.onclose?.({code:1000});for(const fn of this.events.close||[])fn();},0);}
   send(raw){const p=JSON.parse(raw),emit=x=>{const event={data:JSON.stringify(x)};this.onmessage?.(event);for(const fn of this.events.message||[])fn(event);};
    if(p.type==='JOIN'){window.joins.push(p.roomId);const room=rooms.find(r=>r.id===p.roomId)||rooms[0];emit({type:'WELCOME',userId:'owner',scene:{roomId:room.id,name:room.name,ownerId:room.ownerId,heightmap:'0000\n0000\n0000\n0000',items:[]},bootstrap});}
    if(p.type==='LEAVE')emit({type:'LEFT'});
    if(p.type==='ACTION'){
     if(p.action==='delete_room'){window.deletions.push(p.data);rooms.splice(rooms.findIndex(r=>r.id===p.data.roomId),1);}
     emit({type:'RESULT',requestId:p.requestId,data:p.action==='bootstrap'?bootstrap:{ok:true}});
    }
   }
  };
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#roomName')).toHaveText('My Cozy Room');
 await page.locator('[data-panel="rooms"]').click();
 await expect(page.getByRole('button',{name:'Delete room',exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'Delete room',exact:true}).click();
 await expect(page.locator('#panelTitle')).toHaveText('Delete this room?');
 await expect(page.locator('#panelContent')).toContainText('My Cozy Room');
 await expect(page.locator('#panelContent')).toContainText('All furniture returns to your Backpack');
 await expect(page.getByRole('button',{name:'Keep room',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Keep room',exact:true}).click();expect(await page.evaluate(()=>window.deletions)).toEqual([]);
 await page.getByRole('button',{name:'Delete room',exact:true}).click();await page.getByRole('button',{name:'Close panel',exact:true}).click();expect(await page.evaluate(()=>window.deletions)).toEqual([]);
 await page.locator('[data-panel="rooms"]').click();await page.getByRole('button',{name:'Delete room',exact:true}).click();await page.getByRole('button',{name:'Yes, delete room',exact:true}).click();
 await expect(page.locator('#roomName')).toHaveText('Earnly Plaza');
 expect(await page.evaluate(()=>window.deletions)).toEqual([{roomId:'mine',confirm:true}]);
 await page.locator('[data-panel="rooms"]').click();await expect(page.locator('.room-card')).toHaveCount(2);await expect(page.getByRole('button',{name:'Delete room',exact:true})).toHaveCount(0);
 await expect(page.locator('#coinBalance')).toContainText('500');
});

test('World art stays crisp at close zoom and detailed furniture remains selectable',async({page},testInfo)=>{
 const fs=require('node:fs');
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>null};'}));
 await page.route('**/world-renderer.js',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync('world-renderer.js','utf8')+';{const Base=EarnlyWorldRenderer.WorldRenderer;EarnlyWorldRenderer.WorldRenderer=class extends Base{constructor(...a){super(...a);window.testRenderer=this;}};}'}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});await page.goto('/world.html');
 await page.evaluate(()=>{
  document.getElementById('worldEntry').hidden=true;document.getElementById('worldConnected').hidden=false;
  const r=window.testRenderer;r.resize();r.localUserId='art-player';
  r.setScene({roomId:'art-fixture',heightmap:Array(8).fill('00000000').join('\n'),items:[
   {id:'cabinet',sprite:'arcade',color:'#efbf56',x:2,y:1,z:0,width:1,length:1,rotation:0},
   {id:'seat',sprite:'chair',color:'#799ff5',x:4,y:2,z:0,width:1,length:1,rotation:0},
   {id:'water',sprite:'fountain',color:'#b2d7cd',x:4,y:5,z:0,width:1,length:1,rotation:0},
   {id:'fern',sprite:'plant',color:'#67bc89',x:1,y:3,z:0,width:1,length:1,rotation:0}
  ]});
  r.updateUser({userId:'art-player',username:'DREAMER',position:{x:3,y:3,z:0},state:'std'});r.setZoom(2.2);
  const draw=r.c.drawImage.bind(r.c);r.c.drawImage=(source,...args)=>{if(source instanceof HTMLCanvasElement&&source.height===256)window.crispAvatarSeen=true;return draw(source,...args);};
 });
 await expect.poll(()=>page.evaluate(()=>window.crispAvatarSeen)).toBe(true);
 const hits=await page.evaluate(()=>{const r=window.testRenderer;return r.scene.items.map(i=>r.pickItem((i.x-i.y)*18,(i.x+i.y)*9-8)?.id);});
 expect(hits).toEqual(['cabinet','seat','water','fern']);
 await page.locator('#worldCanvas').screenshot({path:`test-results/world-art-${testInfo.project.name}.png`});
 // Exercise the high-resolution source rectangles for every pose, including walking slices.
 await page.evaluate(()=>{const r=window.testRenderer;for(const state of ['sit','lay','std']){r.updateUser({userId:'art-player',position:{x:3,y:3,z:0},state});r.draw();}r.updateUser({userId:'art-player',position:{x:4,y:3,z:0},state:'walk'});});
 await page.waitForTimeout(150);expect(errors).toEqual([]);
});

test('World coin panel preserves its socket and opens the shop separately',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{
  window.worldCloses=0;window.worldJoins=0;
  window.WebSocket=class{constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),10);}close(){window.worldCloses++;this.readyState=3;}send(raw){const p=JSON.parse(raw);if(p.type==='JOIN'){window.worldJoins++;this.onmessage?.({data:JSON.stringify({type:'WELCOME',userId:'owner',scene:{roomId:'home',name:'Home',ownerId:'owner',heightmap:'0000\n0000\n0000\n0000',items:[]},bootstrap:{balance:2232,rooms:[],catalog:[],items:[],friends:[]}})});}if(p.type==='ACTION')this.onmessage?.({data:JSON.stringify({type:'RESULT',requestId:p.requestId,data:{balance:2232,rooms:[],catalog:[],items:[],friends:[]}})});}};
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#connectionStatus')).toContainText('Live');
 await page.locator('#coinBalance').click();await expect(page.locator('#worldWalletBalance')).toHaveText('2,232');
 const buy=page.getByRole('link',{name:'Buy more coins'});await expect(buy).toHaveAttribute('href','avatars.html#coin-shop');await expect(buy).toHaveAttribute('target','_blank');
 await page.getByRole('button',{name:'Back to room',exact:true}).click();await expect(page.locator('#worldPanel')).not.toBeVisible();
 expect(await page.evaluate(()=>({closes:window.worldCloses,joins:window.worldJoins}))).toEqual({closes:0,joins:1});await expect(page.locator('#connectionStatus')).toContainText('Live');
});

for(const motion of ['reduce','no-preference'])test(`Equipped avatars retain alternating footsteps with ${motion} motion`,async({page},testInfo)=>{
 await page.emulateMedia({reducedMotion:motion});await page.route('https://**',r=>r.abort());await page.goto('/world.html');
 await page.evaluate(async()=>{const urls=['cosmetic-cyber-starter.svg','cosmetic-starter-suit.svg','cosmetic-canvas-shoes.svg','cosmetic-neon-phantom.svg'];await Promise.all(urls.map(src=>new Promise(resolve=>{const i=new Image();i.onload=i.onerror=resolve;i.src=src;})));});
 const result=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.style='width:390px;height:400px';document.body.append(canvas);const r=new EarnlyWorldRenderer.WorldRenderer(canvas,()=>{});r.running=false;r.resize();r.setScene({roomId:'walk',heightmap:'0000\n0000\n0000\n0000',items:[]});
  const results=[];for(const id of ['cyber-starter','neon-phantom']){
   r.setUsers([{userId:'walker',position:{x:2,y:2,z:0},state:'wlk',equipped:{avatar:{id,imageUrl:'cosmetic-'+id+'.svg'},outfit:{imageUrl:'cosmetic-starter-suit.svg'},shoes:{imageUrl:'cosmetic-canvas-shoes.svg'}}}]);
   r.draw();await new Promise(resolve=>setTimeout(resolve,100));r.draw();
   const captures=[];const original=r.c.drawImage.bind(r.c);r.c.drawImage=(source,...args)=>{if(args[1]===184&&args[2]===96&&args[3]===72)captures.push(args[0]);return original(source,...args);};
   const u=r.users.get('walker');u.gait=1;u.phase=Math.PI/2;r.draw();const a=canvas.toDataURL();u.gait=1;u.phase=Math.PI*1.5;r.draw();const b=canvas.toDataURL();r.c.drawImage=original;
   results.push({id,left:captures.includes(0),right:captures.includes(96),different:a!==b});
  }canvas.remove();return results;
 });
 for(const avatar of result){expect(avatar.left,avatar.id).toBe(true);expect(avatar.right,avatar.id).toBe(true);expect(avatar.different,avatar.id).toBe(true);}
});

test('Friends offer open room choices with player counts and entering uses the selected room',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{
  window.roomJoins=[];
  const rooms=[{id:'empty',name:'Quiet room',ownerId:null,occupancy:0},{id:'home',name:'My room',ownerId:'owner',occupancy:1},{id:'plaza',name:'Busy plaza',ownerId:null,occupancy:3},{id:'unknown',name:'Unknown room',ownerId:null}];window.roomDirectory=rooms;
  const bootstrap={rooms,balance:500,catalog:[],items:[],friends:[{userId:'friend',username:'Buddy',accepted:true,online:false}]};
  window.WebSocket=class{static OPEN=1;constructor(){this.readyState=1;this.events={};setTimeout(()=>this.onopen?.(),10);}addEventListener(name,fn){(this.events[name]??=[]).push(fn);}removeEventListener(name,fn){this.events[name]=(this.events[name]||[]).filter(f=>f!==fn);}close(){this.readyState=3;setTimeout(()=>{this.onclose?.({code:1000});for(const fn of this.events.close||[])fn();},0);}send(raw){const p=JSON.parse(raw),send=data=>{const event={data:JSON.stringify(data)};this.onmessage?.(event);for(const fn of this.events.message||[])fn(event);};
   if(p.type==='JOIN'){window.roomJoins.push(p.roomId);send({type:'WELCOME',userId:'owner',scene:{roomId:p.roomId,name:p.roomId==='garden'?'Buddy Garden':'Home',ownerId:p.roomId==='garden'?'friend':'owner',heightmap:'0000\n0000\n0000\n0000',items:[]},bootstrap});}
   if(p.type==='LEAVE')send({type:'LEFT'});
   if(p.type==='ACTION'&&p.action==='room_directory'){window.finishRoomDirectory=()=>send({type:'RESULT',requestId:p.requestId,data:rooms});return;}
   if(p.type==='ACTION')send({type:'RESULT',requestId:p.requestId,data:p.action==='friend_rooms'?(window.emptyFriendRooms?[]:[{id:'lounge',name:'Buddy Lounge',ownerId:'friend',occupancy:0},{id:'garden',name:'Buddy Garden',ownerId:'friend',occupancy:2}]):p.action==='room_directory'?rooms:bootstrap});
  }};
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#connectionStatus')).toContainText('Live');
 await page.locator('[data-panel="rooms"]').click();
 await expect(page.getByRole('button',{name:'＋ Create room · Free',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'My room →',exact:true})).toBeDisabled();
 await page.evaluate(()=>window.finishRoomDirectory());
 await expect(page.getByRole('button',{name:'＋ Create room · Free',exact:true})).toBeEnabled();
 await expect(page.getByRole('button',{name:'My room →',exact:true})).toBeEnabled();
 await expect(page.locator('.room-occupancy')).toHaveText(['3 players in room','1 player in room','0 players in room','Player count unavailable']);
 await expect(page.locator('.room-card').first()).toContainText('Busy plaza');
 await page.evaluate(()=>{window.roomDirectory[0].occupancy=4;});
 await page.getByRole('button',{name:'Refresh rooms',exact:true}).click();
 await page.evaluate(()=>window.finishRoomDirectory());
 await expect(page.locator('.room-card').first()).toContainText('Quiet room');
 await expect(page.locator('.room-occupancy').first()).toHaveText('4 players in room');
 await page.locator('#closePanel').click();
 await page.locator('[data-panel="friends"]').click();await page.locator('#panelContent').getByRole('button',{name:'Rooms',exact:true}).click();
 await expect(page.locator('#panelTitle')).toHaveText('Buddy’s rooms');await expect(page.locator('.room-occupancy')).toHaveText(['2 players in room','0 players in room']);
 await page.locator('.room-card').filter({hasText:'Buddy Garden'}).getByRole('button',{name:'Enter room'}).click();
 await expect(page.locator('#roomName')).toHaveText('Buddy Garden');expect(await page.evaluate(()=>window.roomJoins)).toEqual(['choose-home','garden']);
 await page.evaluate(()=>{window.emptyFriendRooms=true;});await page.locator('[data-panel="friends"]').click();await page.locator('#panelContent').getByRole('button',{name:'Rooms',exact:true}).click();await expect(page.locator('#panelContent')).toContainText('No rooms open to visitors yet');await page.getByRole('button',{name:'Back to friends'}).click();await expect(page.locator('#panelTitle')).toHaveText('Friends');
});

test('Shared room invitation preserves sign-in destination and rejects invalid room IDs',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>null};'}));
 const id='d814eae3-14d0-43ef-ae1a-6cbd48aad149';
 await page.goto('/world.html?room='+id);
 await expect(page.locator('#panelContent a')).toHaveAttribute('href','account.html?worldRoom='+id);
 await page.goto('/account.html?worldRoom='+id);
 expect(await page.evaluate(()=>EarnlyWorldLinks.afterSignIn())).toBe('world.html?room='+id);
 await page.goto('/account.html?worldRoom=https://evil.example');
 expect(await page.evaluate(()=>EarnlyWorldLinks.afterSignIn())).toBe('index.html');
 await page.goto('/world.html?room=invalid');
 await expect(page.locator('#worldPanel')).not.toBeVisible();
});

test('Shared room enters directly, sharing keeps connection, and first-visit hint stays dismissed',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{
  window.joins=[];window.closes=0;
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedRoom=text;}}});
  window.WebSocket=class{constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),10);}close(){window.closes++;this.readyState=3;}send(raw){const p=JSON.parse(raw);if(p.type==='JOIN'){window.joins.push(p.roomId);this.onmessage?.({data:JSON.stringify({type:'WELCOME',userId:'guest',scene:{roomId:p.roomId,name:'Friend Garden',ownerId:'friend',access:'open',heightmap:'0000\n0000\n0000\n0000',items:[]},bootstrap:{balance:0,rooms:[],catalog:[],items:[],friends:[]}})});}}};
 });
 const id='d814eae3-14d0-43ef-ae1a-6cbd48aad149';
 await page.setViewportSize({width:390,height:844});await page.goto('/world.html?room='+id);
 await expect(page.locator('#roomName')).toHaveText('Friend Garden');
 expect(await page.evaluate(()=>window.joins)).toEqual([id]);
 await expect(page.locator('#firstVisitHint')).toBeVisible();await page.locator('#dismissWorldHint').click();
 await page.locator('#shareRoom').click();await page.getByRole('button',{name:'Copy link',exact:true}).click();
 expect(await page.evaluate(()=>window.copiedRoom)).toBe('https://earnlyarcade.com/world.html?room='+id);
 expect(await page.evaluate(()=>window.closes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.reload();await expect(page.locator('#roomName')).toHaveText('Friend Garden');await expect(page.locator('#firstVisitHint')).toBeHidden();
});

test('A denied shared room offers own room without automatically retrying admission',async({page})=>{
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{window.joins=[];window.WebSocket=class{constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),10);}send(raw){const p=JSON.parse(raw);if(p.type==='JOIN'){window.joins.push(p.roomId);this.readyState=3;this.onclose?.({code:1008});}}};});
 const id='d814eae3-14d0-43ef-ae1a-6cbd48aad149';await page.goto('/world.html?room='+id);
 await expect(page.locator('#panelTitle')).toHaveText('Room unavailable');
 await page.getByRole('button',{name:'Go to my room',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.joins)).toEqual([id,'choose-home']);
});
