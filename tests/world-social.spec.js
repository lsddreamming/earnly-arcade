const {test,expect}=require('@playwright/test');
async function fixture(page,guest=false){
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(({guest})=>{
  const actor='22222222-2222-4222-8222-222222222222',friend='11111111-1111-4111-8111-111111111111';window.socialActions=[];window.joins=[];
  window.WebSocket=class extends EventTarget{
   static OPEN=1;constructor(){super();this.readyState=1;window.socialSocket=this;setTimeout(()=>this.onopen?.(),10);}
   emit(p){const data=JSON.stringify(p);this.onmessage?.({data});this.dispatchEvent(new MessageEvent('message',{data}));}
   close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
   send(raw){const p=JSON.parse(raw);if(p.type==='LEAVE'){this.emit({type:'LEFT'});return;}if(p.type==='JOIN'){window.joins.push(p.roomId);this.bootstrap={socialDiscovery:true,dailyMissions:true,balance:100,rooms:[],items:[],catalog:[],friends:[{userId:friend,username:'Buddy',accepted:true,online:true}]};this.emit({type:'WELCOME',userId:actor,scene:{roomId:'current-room',ownerId:guest?friend:actor,name:'Cozy room',access:'open',heightmap:'0000\n0000\n0000\n0000',items:[]},bootstrap:this.bootstrap});this.emit({type:'ROOM_SNAPSHOT',users:[]});return;}
    if(p.type!=='ACTION')return;window.socialActions.push(p);let data={};
    if(p.action==='react')this.mine=p.data.reaction;
    if(['react','reactions'].includes(p.action))data={heart:this.mine==='heart'?1:0,thumb:this.mine==='thumb'?1:0,mine:this.mine??null,canReact:guest};
    if(p.action==='featured')data=[{id:'featured-room',name:'Neon <Garden>',ownerId:friend,ownerUsername:'Buddy',heightmap:'0000\n0000\n0000\n0000',items:[{id:'preview-chair',x:2,y:2,z:0,sprite:'chair',width:1,length:1,color:'#74c9ba',rotation:0,itemHeight:1}],score:3,occupancy:2,weeklyEntry:true}];
    if(p.action==='invite')data={duplicate:false};
    if(p.action==='dismiss_invite')this.dismissed=true;
    if(['invites','dismiss_invite'].includes(p.action))data=this.dismissed?[]:[{id:'33333333-3333-4333-8333-333333333333',roomId:'invited-room',roomName:'Buddy’s room',username:'Buddy',expiresAt:'2026-10-19T16:00:00Z'}];
    if(p.action==='weekly_enter')this.entered=true;
    if(['weekly','weekly_enter'].includes(p.action))data={theme:'Cozy Arcade',week:'2026-10-19',endsAt:'2026-10-26T00:00:00Z',entered:!!this.entered,ready:true,reward:10,entryRoomId:this.entered?'current-room':null};
    if(p.action==='bootstrap')data={...this.bootstrap,balance:this.entered?110:100};
    this.emit({type:'RESULT',requestId:p.requestId,data});
   }
  };
 },{guest});
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#worldConnected')).toBeVisible();
}
test('Room reactions toggle and featured rooms show safe previews with working visits',async({page})=>{
 await fixture(page,true);await page.locator('#worldCommunity').click();await page.locator('#worldReactions').click();const heart=page.getByRole('button',{name:/Love it/});await heart.click();await expect(heart).toHaveAttribute('aria-pressed','true');await heart.click();await expect(heart).toHaveAttribute('aria-pressed','false');
 await page.locator('#closePanel').click();await page.locator('#worldCommunity').click();await page.locator('#worldFeatured').click();await expect(page.locator('.featured-room-card')).toContainText('Neon <Garden>');await expect(page.locator('.featured-room-card canvas')).toBeVisible();expect(await page.locator('.featured-room-card canvas').evaluate(c=>{const empty=document.createElement('canvas');EarnlyWorldRenderer.roomThumbnail(empty,'0000\n0000\n0000\n0000');return c.toDataURL()!==empty.toDataURL();})).toBe(true);expect(await page.locator('.featured-room-card garden').count()).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/world-social-featured.png',fullPage:true});await page.getByRole('button',{name:'Visit room',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.joins.at(-1))).toBe('featured-room');
});
test('Friends can invite, dismiss and join rooms; weekly entry refreshes the balance once',async({page})=>{
 await fixture(page);await page.locator('[data-panel="friends"]').click();await page.getByRole('button',{name:'Invite here',exact:true}).click();await expect(page.locator('#worldToast')).toContainText('Invited Buddy');
 await page.locator('#closePanel').click();await page.evaluate(()=>window.socialSocket.emit({type:'ROOM_INVITE'}));await expect(page.locator('#worldCommunity')).toContainText('New invite');await page.locator('#worldCommunity').click();await page.locator('#worldInvites').click();await expect(page.locator('.room-invite-card')).toContainText('Buddy’s room');await page.getByRole('button',{name:'Dismiss',exact:true}).click();await expect(page.locator('#panelContent')).toContainText('No invitations right now');
 await page.locator('#closePanel').click();await page.locator('#worldCommunity').click();await page.locator('#worldWeekly').click();await expect(page.locator('.weekly-theme')).toHaveText('Cozy Arcade');await page.screenshot({path:'test-results/world-social-weekly.png',fullPage:true});await page.getByRole('button',{name:'Enter this room & claim 10 coins',exact:true}).click();await expect(page.locator('#coinBalance')).toHaveText('◇ 110');await expect(page.locator('#panelContent')).toContainText('Entered · 10 coins claimed');expect(await page.evaluate(()=>window.socialActions.filter(p=>p.action==='weekly_enter').length)).toBe(1);
 await page.locator('#closePanel').click();await page.evaluate(()=>{window.socialSocket.dismissed=false;});await page.locator('#worldCommunity').click();await page.locator('#worldInvites').click();await page.getByRole('button',{name:'Join room',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.joins.at(-1))).toBe('invited-room');
});
