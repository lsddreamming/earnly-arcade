const {test,expect}=require('@playwright/test');
async function fixture(page,{empty=false,guest=false,rug=false}={}){
 await page.route('https://**',r=>r.abort());
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.route('**/world-renderer.js*',r=>r.fulfill({contentType:'application/javascript',body:require('fs').readFileSync('world-renderer.js','utf8')+';{const Base=EarnlyWorldRenderer.WorldRenderer;EarnlyWorldRenderer.WorldRenderer=class extends Base{constructor(...a){super(...a);window.testRenderer=this;}};}'}));
 await page.addInitScript(({empty,guest,rug})=>{
  window.actions=[];window.joins=[];
  const catalog=[{id:'chair',name:'Mint Chair',sprite_id:'chair',price:60,item_height:1,walkable:false,can_stack:false,can_sit:true,can_lay:false,width:1,length:1,color:'#74c9ba',category:'Essentials',minted:0}];
  if(rug)Object.assign(catalog[0],{name:'Mint Tile Rug',sprite_id:'rug',width:2,length:2,item_height:0.25,walkable:true,can_stack:true,can_sit:false});
  const bootstrap={balance:0,chatAccepted:true,dailyMissions:true,catalog,items:empty?[]:[{id:'chair1',definition_id:'chair',room_id:null,serial:1}],rooms:[{id:'home',name:'My room',ownerId:'guide-owner'},{id:'plaza',name:'Earnly Plaza',ownerId:null,occupancy:2},{id:'quiet',name:'Quiet room',ownerId:null,occupancy:0}],friends:[]};
  window.WebSocket=class extends EventTarget{
   static OPEN=1;constructor(){super();this.readyState=1;window.guideSocket=this;setTimeout(()=>this.onopen?.(),10);}
   emit(p){const data=JSON.stringify(p);this.onmessage?.({data});this.dispatchEvent(new MessageEvent('message',{data}));}
   close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
   send(raw){const p=JSON.parse(raw);if(p.type==='LEAVE'){this.emit({type:'LEFT'});return;}
    if(p.type==='JOIN'){window.joins.push(p.roomId);this.scene={roomId:p.roomId==='plaza'?'plaza':'home',ownerId:p.roomId==='plaza'?null:guest&&window.joins.length===1?'friend':'guide-owner',name:'My room',chatRange:p.roomId==='plaza'?'nearby':'room',access:'open',heightmap:rug?[...Array(8).fill('2222222222222222'),'1111111111111111',...Array(7).fill('00000000xxxxxxxx')].join('\n'):Array(8).fill('00000000').join('\n'),items:[]};this.emit({type:'WELCOME',userId:'guide-owner',scene:this.scene,bootstrap});this.emit({type:'ROOM_SNAPSHOT',users:[{userId:'guide-owner',position:{x:0,y:0,z:rug?2:0}}]});return;}
    if(p.type==='ACTION'){window.actions.push(p);if(p.action==='place'&&window.rejectPlacement){this.emit({type:'RESULT',requestId:p.requestId,error:'Tile blocked',definite:true});return;}
     if(p.action==='place'){bootstrap.items[0].room_id='home';this.scene.items=[{id:'chair1',name:'Mint Chair',sprite:'chair',width:1,length:1,x:p.data.x,y:p.data.y,z:0,rotation:0}];this.emit({type:'SCENE',scene:this.scene});}
     if(p.action==='rename_room')bootstrap.rooms[0].name=p.data.name;
     this.emit({type:'RESULT',requestId:p.requestId,data:p.action==='rename_room'?{roomId:p.data.roomId,name:p.data.name}:p.action==='room_directory'?bootstrap.rooms:p.action==='bootstrap'?bootstrap:p.action==='daily_missions'?{resetsAt:'2026-10-21T00:00:00Z',missions:[{id:'decorate',title:'Make your room yours',complete:true,claimed:false}]}:{}});
    }
   }
  };
 },{empty,guest,rug});
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#worldConnected')).toBeVisible();
}
async function walked(page){await page.evaluate(()=>window.guideSocket.emit({type:'ROOM_DELTA',users:[{userId:'guide-owner',position:{x:1,y:0,z:window.testRenderer.users.get('guide-owner').position.z}}]}));await expect(page.locator('#guideStep')).toContainText('2 / 3');}
async function place(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const p=await page.evaluate(()=>{const r=window.testRenderer,b=r.canvas.getBoundingClientRect();return {x:b.left+r.cx,y:b.top+r.cy+4*9*r.scale};});await page.mouse.click(p.x,p.y);await expect(page.locator('#dropItem')).toBeVisible();await page.locator('#dropItem').click();}
test('First visit uses owned furniture, rejects failed placement, then celebrates real completion',async({page})=>{
 await fixture(page);await walked(page);await page.locator('#guideAction').click();await expect(page.locator('#panelContent')).toContainText('Already yours · No coins needed');
 await page.getByRole('button',{name:'Place this piece',exact:true}).click();await page.locator('#cancelPlace').click();await expect(page.locator('#guideStep')).toContainText('2 / 3');
 await page.locator('#guideAction').click();await page.getByRole('button',{name:'Place this piece',exact:true}).click();await page.evaluate(()=>window.rejectPlacement=true);await place(page);await expect(page.locator('#worldToast')).toContainText('Tile blocked');await expect(page.locator('#guideStep')).toContainText('2 / 3');
 await page.evaluate(()=>window.rejectPlacement=false);await page.locator('#dropItem').click();await expect(page.locator('#placementSuccess')).toBeVisible();await page.screenshot({path:'test-results/world-onboarding-saved.png',fullPage:true});await page.locator('#placementMissions').click();await expect(page.getByRole('button',{name:'Claim 5 coins',exact:true})).toBeVisible();expect(await page.evaluate(()=>window.actions.some(a=>a.data.claim))).toBe(false);await page.locator('#closePanel').click();await expect(page.locator('#guideStep')).toContainText('3 / 3');await page.locator('#guideAction').click();await page.locator('.room-card').filter({hasText:'Earnly Plaza'}).getByRole('button',{name:'Visit →',exact:true}).click();await expect(page.locator('#guideStep')).toContainText('You’re ready');await expect(page.locator('#guideProgress')).toHaveText('3 of 3 complete');
 expect(await page.evaluate(()=>window.actions.some(a=>a.action==='buy'))).toBe(false);
});
test('Empty Backpack offers priced options and earning without an automatic purchase',async({page})=>{
 await page.setViewportSize({width:320,height:740});await fixture(page,{empty:true});await walked(page);await page.locator('#guideAction').click();await expect(page.locator('#panelContent')).toContainText('Your Backpack is empty');await expect(page.locator('#panelContent')).toContainText('60 Arcade Coins');await expect(page.getByRole('button',{name:'Need 60 more coins'})).toBeDisabled();await expect(page.getByRole('link',{name:'Play games to earn coins ↗'})).toHaveAttribute('href','games.html');expect(await page.evaluate(()=>window.actions.length)).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/world-onboarding-empty.png',fullPage:true});
});
test('Guide resumes saved progress and takes visitors home before offering placement',async({page})=>{
 await fixture(page,{guest:true});await walked(page);await page.locator('#dismissWorldHint').click();await expect(page.locator('#firstVisitHint')).toBeHidden();await page.locator('#worldGuide').click();await expect(page.locator('#guideAction')).toHaveText('Go to my room');await page.locator('#guideAction').click();await expect(page.locator('#panelTitle')).toHaveText('Make this room yours');await page.getByRole('button',{name:'Back to my room'}).click();await expect(page.locator('#firstVisitHint')).toBeVisible();await page.locator('#dismissWorldHint').click();await page.reload();await page.locator('#connectWorld').click();await expect(page.locator('#firstVisitHint')).toBeHidden();await page.locator('#worldGuide').click();await expect(page.locator('#guideStep')).toContainText('2 / 3');
});

test('Guided preview does not save until confirmed and empty screens offer a next step',async({page})=>{
 await fixture(page);await walked(page);await page.locator('#guideAction').click();await page.getByRole('button',{name:'Place this piece',exact:true}).click();
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const p=await page.evaluate(()=>{const r=window.testRenderer,b=r.canvas.getBoundingClientRect();return {x:b.left+r.cx,y:b.top+r.cy+4*9*r.scale};});
 await page.mouse.click(p.x,p.y);await expect(page.locator('#dropItem')).toBeVisible();await page.mouse.click(p.x,p.y);
 expect(await page.evaluate(()=>window.actions.filter(a=>a.action==='place').length)).toBe(0);
 await page.locator('#cancelPlace').click();await expect(page.locator('#placementSuccess')).toBeHidden();
 await page.locator('[data-panel="friends"]').click();await expect(page.locator('#panelContent')).toContainText('Meet players in a public hangout');await expect(page.getByRole('button',{name:'Visit plaza',exact:true})).toBeVisible();
});
test('Empty Backpack hides unused filters and offers first furniture or games',async({page})=>{
 await fixture(page,{empty:true});await page.locator('[data-panel="backpack"]').click();
 await expect(page.getByRole('button',{name:'Choose my first piece'})).toBeVisible();await expect(page.getByRole('searchbox',{name:'Find your furniture'})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Play games to earn coins ↗'})).toHaveAttribute('href','games.html');
 await page.getByRole('button',{name:'Choose my first piece'}).click();await expect(page.locator('#panelTitle')).toHaveText('Make this room yours');
});

test('placement explains blocked tiles and refreshes after moving or rotating the room',async({page})=>{
 await fixture(page);await walked(page);await page.locator('#guideAction').click();await page.getByRole('button',{name:'Place this piece',exact:true}).click();
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const tile=await page.evaluate(()=>{const r=window.testRenderer,b=r.canvas.getBoundingClientRect();return {x:b.left+r.cx,y:b.top+r.cy+4*9*r.scale};});
 await page.mouse.click(tile.x,tile.y);await expect(page.locator('#dropItem')).toBeVisible();
 await page.evaluate(()=>{const r=window.testRenderer;r.placement.x=-1;r.placement.y=-1;r.draw();});
 await expect(page.locator('#placementStatus')).toHaveAttribute('data-valid','false');await expect(page.locator('#placementStatus')).not.toBeEmpty();
 await page.evaluate(()=>{const r=window.testRenderer;r.placement.x=3;r.placement.y=3;r.rotateView(1);r.draw();});
 await expect(page.locator('#placementStatus')).toHaveText('Fits here · Ready to place');
 expect(await page.evaluate(()=>window.actions.filter(a=>a.action==='place').length)).toBe(0);
 await page.locator('#cancelPlace').click();await expect(page.locator('#placementStatus')).toBeEmpty();
});

 test('Catalog clear filters restores hidden pieces without changing wishlist or purchases',async({page})=>{
 await fixture(page);await page.locator('[data-panel="catalog"]').click();
 await expect(page.getByRole('button',{name:'Clear filters',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Save to wishlist: Mint Chair',exact:true}).click();
 await page.locator('.catalog-refine summary').click();
 await page.getByRole('button',{name:/Wishlist/}).click();
 await page.getByRole('button',{name:'Not owned',exact:true}).click();
 await page.getByRole('combobox',{name:'Sort decor'}).selectOption('price');
 await page.getByRole('searchbox',{name:'Search decor'}).fill('missing furniture');
 await expect(page.locator('.catalog-grid .item-card')).toHaveCount(0);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await expect(page.getByRole('searchbox',{name:'Search decor'})).toHaveValue('');
 await expect(page.getByRole('searchbox',{name:'Search decor'})).toBeFocused();
 await expect(page.locator('.catalog-grid .item-card')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Remove from wishlist: Mint Chair',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Clear filters',exact:true})).toBeHidden();
 expect(await page.evaluate(()=>window.actions.some(a=>a.action==='buy'))).toBe(false);
 });

test('World reconnects after offline loss without replaying actions',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.guideSocket.readyState=3;window.guideSocket.onclose({code:1006});});
 await expect(page.locator('#entryStatus')).toContainText('We’ll reconnect when your internet returns');
 await expect(page.locator('#connectionStatus')).toContainText('Offline');
 expect(await page.evaluate(()=>window.joins.length)).toBe(1);
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));});
 await expect(page.locator('#worldConnected')).toBeVisible();
 expect(await page.evaluate(()=>window.joins.length)).toBe(2);
 expect(await page.evaluate(()=>window.actions)).toEqual([]);
});
test('Account change cancels pending offline recovery',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.guideSocket.readyState=3;window.guideSocket.onclose({code:1006});window.dispatchEvent(new Event('earnly-cloud-auth-change'));Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));});
 await expect(page.locator('#entryStatus')).toContainText('Your account changed');
 expect(await page.evaluate(()=>window.joins.length)).toBe(1);
});

test('Split-level rug starts on a valid preview and saves once with a reachable touch button',async({page,isMobile})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,{rug:true});await walked(page);
 await page.locator('#guideAction').click();await page.getByRole('button',{name:'Place this piece',exact:true}).click();
 await expect(page.locator('#placementStatus')).toHaveAttribute('data-valid','true');
 expect(await page.evaluate(()=>window.actions.filter(a=>a.action==='place'))).toHaveLength(0);
 const box=await page.locator('#dropItem').boundingBox();expect(box.y).toBeGreaterThan(0);expect(box.y+box.height).toBeLessThan(844);
 const preview=await page.evaluate(()=>({x:testRenderer.placement.x,y:testRenderer.placement.y}));
 await page.screenshot({path:'test-results/world-rug-ready.png'});
 if(isMobile)await page.locator('#dropItem').tap();else await page.locator('#dropItem').click();await expect(page.locator('#placementSuccess')).toBeVisible();
 const saved=await page.evaluate(()=>window.actions.filter(a=>a.action==='place'));
 expect(saved).toHaveLength(1);expect(saved[0].data).toMatchObject(preview);
});
test('Owned rooms can be renamed repeatedly from the header and room list',async({page})=>{
 await fixture(page);await page.locator('#renameRoom').click();
 await page.getByLabel('Room name',{exact:true}).fill('Shrimpy’s Retreat');await page.getByRole('button',{name:'Save name',exact:true}).click();
 await expect(page.locator('#roomName')).toHaveText('Shrimpy’s Retreat');await expect(page.locator('.room-card')).toContainText('Shrimpy’s Retreat');
 await page.locator('.room-card').getByRole('button',{name:'Rename room',exact:true}).click();
 await page.getByLabel('Room name',{exact:true}).fill('   ');await page.getByRole('button',{name:'Save name',exact:true}).click();await expect(page.locator('#panelContent')).toContainText('Use 1–40');
 await page.getByLabel('Room name',{exact:true}).fill('New lounge');await page.getByRole('button',{name:'Save name',exact:true}).click();await expect(page.locator('#roomName')).toHaveText('New lounge');
 expect(await page.evaluate(()=>window.actions.filter(a=>a.action==='rename_room').length)).toBe(2);
});

test('New players can find company and use public chat before walking or buying',async({page})=>{
 await page.setViewportSize({width:320,height:740});await fixture(page,{empty:true});
 await expect(page.locator('#guideStep')).toContainText('1 / 3');
 await expect(page.locator('#publicChatHelp')).toContainText('Everyone in this room');
 await page.locator('#sayText').fill('Hey everyone');await page.locator('#guideHello').click();
 await expect(page.locator('#sayText')).toBeFocused();await expect(page.locator('#sayText')).toHaveValue('Hey everyone');
 expect(await page.evaluate(()=>window.actions.some(a=>a.action==='say'))).toBe(false);
 await page.locator('#guideHangout').click();
 await expect(page.getByRole('button',{name:'Public Hangouts',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.room-card').first()).toContainText('Earnly Plaza');
 await expect(page.locator('.room-card').first()).toContainText('2 players in room');
 await page.locator('.room-card').first().getByRole('button',{name:'Visit →',exact:true}).click();
 await expect(page.locator('#publicChatHelp')).toContainText('within 8 tiles');
 await page.locator('#guideHello').click();await page.locator('#sayText').fill('What’s up?');await page.locator('#sayForm button').click();
 expect(await page.evaluate(()=>window.actions.filter(a=>a.action==='say').map(a=>a.data))).toEqual([expect.objectContaining({text:'What’s up?',mode:'normal'})]);
 expect(await page.evaluate(()=>window.actions.some(a=>['buy','place'].includes(a.action)))).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/world-first-visit-social.png',fullPage:true});
});
