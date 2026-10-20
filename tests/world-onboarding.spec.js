const {test,expect}=require('@playwright/test');
async function fixture(page,{empty=false,guest=false}={}){
 await page.route('https://**',r=>r.abort());
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.route('**/world-renderer.js*',r=>r.fulfill({contentType:'application/javascript',body:require('fs').readFileSync('world-renderer.js','utf8')+';{const Base=EarnlyWorldRenderer.WorldRenderer;EarnlyWorldRenderer.WorldRenderer=class extends Base{constructor(...a){super(...a);window.testRenderer=this;}};}'}));
 await page.addInitScript(({empty,guest})=>{
  window.actions=[];window.joins=[];
  const catalog=[{id:'chair',name:'Mint Chair',sprite_id:'chair',price:60,item_height:1,walkable:false,can_stack:false,can_sit:true,can_lay:false,width:1,length:1,color:'#74c9ba',category:'Essentials',minted:0}];
  const bootstrap={balance:0,dailyMissions:true,catalog,items:empty?[]:[{id:'chair1',definition_id:'chair',room_id:null,serial:1}],rooms:[],friends:[]};
  window.WebSocket=class extends EventTarget{
   static OPEN=1;constructor(){super();this.readyState=1;window.guideSocket=this;setTimeout(()=>this.onopen?.(),10);}
   emit(p){const data=JSON.stringify(p);this.onmessage?.({data});this.dispatchEvent(new MessageEvent('message',{data}));}
   close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
   send(raw){const p=JSON.parse(raw);if(p.type==='LEAVE'){this.emit({type:'LEFT'});return;}
    if(p.type==='JOIN'){window.joins.push(p.roomId);this.scene={roomId:p.roomId==='plaza'?'plaza':'home',ownerId:p.roomId==='plaza'?null:guest&&window.joins.length===1?'friend':'guide-owner',name:'My room',access:'open',heightmap:Array(8).fill('00000000').join('\n'),items:[]};this.emit({type:'WELCOME',userId:'guide-owner',scene:this.scene,bootstrap});this.emit({type:'ROOM_SNAPSHOT',users:[{userId:'guide-owner',position:{x:0,y:0,z:0}}]});return;}
    if(p.type==='ACTION'){window.actions.push(p);if(p.action==='place'&&window.rejectPlacement){this.emit({type:'RESULT',requestId:p.requestId,error:'Tile blocked',definite:true});return;}
     if(p.action==='place'){bootstrap.items[0].room_id='home';this.scene.items=[{id:'chair1',name:'Mint Chair',sprite:'chair',width:1,length:1,x:p.data.x,y:p.data.y,z:0,rotation:0}];this.emit({type:'SCENE',scene:this.scene});}
     this.emit({type:'RESULT',requestId:p.requestId,data:p.action==='bootstrap'?bootstrap:p.action==='daily_missions'?{resetsAt:'2026-10-21T00:00:00Z',missions:[{id:'decorate',title:'Make your room yours',complete:true,claimed:false}]}:{}});
    }
   }
  };
 },{empty,guest});
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#worldConnected')).toBeVisible();
}
async function walked(page){await page.evaluate(()=>window.guideSocket.emit({type:'ROOM_DELTA',users:[{userId:'guide-owner',position:{x:1,y:0,z:0}}]}));await expect(page.locator('#guideStep')).toContainText('2 / 3');}
async function place(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const p=await page.evaluate(()=>{const r=window.testRenderer,b=r.canvas.getBoundingClientRect();return {x:b.left+r.cx,y:b.top+r.cy+4*9*r.scale};});await page.mouse.click(p.x,p.y);await expect(page.locator('#dropItem')).toBeVisible();await page.locator('#dropItem').click();}
test('First visit uses owned furniture, rejects failed placement, then celebrates real completion',async({page})=>{
 await fixture(page);await walked(page);await page.locator('#guideAction').click();await expect(page.locator('#panelContent')).toContainText('Already yours · No coins needed');
 await page.getByRole('button',{name:'Place this piece',exact:true}).click();await page.locator('#cancelPlace').click();await expect(page.locator('#guideStep')).toContainText('2 / 3');
 await page.locator('#guideAction').click();await page.getByRole('button',{name:'Place this piece',exact:true}).click();await page.evaluate(()=>window.rejectPlacement=true);await place(page);await expect(page.locator('#worldToast')).toContainText('Tile blocked');await expect(page.locator('#guideStep')).toContainText('2 / 3');
 await page.evaluate(()=>window.rejectPlacement=false);await page.locator('#dropItem').click();await expect(page.locator('#placementSuccess')).toBeVisible();await page.screenshot({path:'test-results/world-onboarding-saved.png',fullPage:true});await page.locator('#placementMissions').click();await expect(page.getByRole('button',{name:'Claim 5 coins',exact:true})).toBeVisible();expect(await page.evaluate(()=>window.actions.some(a=>a.data.claim))).toBe(false);await page.locator('#closePanel').click();await expect(page.locator('#guideStep')).toContainText('3 / 3');await page.locator('#guideAction').click();await expect(page.locator('#guideStep')).toContainText('You’re ready');await expect(page.locator('#guideProgress')).toHaveText('3 of 3 complete');
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
