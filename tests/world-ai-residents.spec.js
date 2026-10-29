const {test,expect}=require('@playwright/test');
async function fixture(page){
 await page.route(url=>url.protocol==='https:',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(()=>{
  Object.defineProperty(window,'EarnlyWorldRenderer',{configurable:true,set(v){const Base=v.WorldRenderer;v.WorldRenderer=class extends Base{constructor(...args){super(...args);window.aiRenderer=this;}};Object.defineProperty(window,'EarnlyWorldRenderer',{value:v,writable:true,configurable:true});}});
  const room='00000000-0000-4000-8000-000000000001';window.aiActions=[];
  const state={quiet:false,remember:false,relations:[{residentId:'jax',friend:false,remember:false,visits:0,topics:[],roomVisits:[],achievements:[]}]};
  const ai={staffId:'ai-jax',residentId:'jax',username:'Jax',role:'comedian · AI resident',isAI:true,isStaff:true,position:{x:2,y:2,z:0},state:'dance',activity:'dancing',equipped:{avatar:{id:'russet-potato',imageUrl:'cosmetic-russet-potato.svg'},outfit:{imageUrl:'cosmetic-starter-suit.svg'},shoes:{imageUrl:'cosmetic-canvas-shoes.svg'}}};
  const staff={staffId:'staff-reception',username:'Pip',role:'Receptionist',isStaff:true,position:{x:4,y:4,z:0},state:'std'};
  const bootstrap={aiResidents:true,aiMemory:true,residentQuiet:false,balance:2000,catalog:[],items:[],rooms:[{id:room,name:'Home',ownerId:'owner',occupancy:1,residentCount:1,spudCount:2},{id:'lobby',name:'Hotel Lobby',ownerId:null,occupancy:0,residentCount:5,spudCount:5}],friends:[]};
  window.WebSocket=class{static OPEN=1;close(){this.readyState=3;}constructor(){this.readyState=1;window.aiSocket=this;setTimeout(()=>this.onopen?.(),10);}emit(p){this.onmessage?.({data:JSON.stringify(p)});}send(raw){const p=JSON.parse(raw);if(p.type==='JOIN'){this.emit({type:'WELCOME',userId:'owner',scene:{roomId:room,name:'Home',ownerId:'owner',heightmap:Array(8).fill('00000000').join('\n'),items:[]},bootstrap});this.emit({type:'ROOM_SNAPSHOT',users:[{userId:'owner',username:'You',position:{x:1,y:2,z:0}}]});this.emit({type:'NPC_SNAPSHOT',staff:[staff,ai]});}
   if(p.type==='ACTION'){window.aiActions.push(p);let data=bootstrap;
    if(p.action==='room_directory')data=bootstrap.rooms;
    if(p.action==='resident_memory')data=state;
    if(p.action==='resident_mode'){state.quiet=p.data.quiet;data={quiet:state.quiet};}
    if(p.action==='resident_settings'){state.remember=p.data.remember;data=state;}
    if(p.action==='resident_friend'){state.relations[0].friend=p.data.friend;data=state;}
    if(p.action==='resident_forget'){state.remember=false;state.relations[0].topics=[];data=state;}
    if(p.action==='resident_chat'){data={isAI:true,text:'Why did the Spud bring a ladder? To reach the next level.'};}
    if(p.action==='resident_invite'||p.action==='resident_dismiss'){ai.invitedBy=p.action==='resident_invite'?'owner':undefined;this.emit({type:'NPC_SNAPSHOT',staff:[staff,ai]});data={isAI:true};}
    if(p.action==='staff_talk')data={name:'Pip',role:'Receptionist',greeting:'Welcome',tip:'Visit a hangout'};
    this.emit({type:'RESULT',requestId:p.requestId,data});
   }
  }};
 });
 await page.goto('/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#connectionStatus')).toContainText('Live');
}
test('AI residents have distinct actions, private chat and Quiet mode with a Spud headcount and separate human occupancy',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await fixture(page);
 await expect(page.locator('#peopleCount')).toHaveText('2 Spuds here');
 await page.locator('[data-panel="staff"]').click();await expect(page.getByRole('button',{name:'Say hello',exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'Meet resident',exact:true}).click();await expect(page.locator('#panelTitle')).toContainText('Jax');await expect(page.locator('#panelTitle .resident-ai-badge')).toHaveText('AI resident');await expect(page.locator('.resident-portrait')).toBeVisible();
 await page.getByRole('button',{name:'Tell me a joke',exact:true}).click();await expect(page.locator('#worldPanel')).toContainText('To reach the next level');
 await page.getByRole('button',{name:'Social settings',exact:true}).click();await page.getByRole('button',{name:'Switch to Quiet mode',exact:true}).click();await expect(page.getByRole('button',{name:'Switch to Natural mode',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>aiActions.find(a=>a.action==='resident_mode').data.quiet)).toBe(true);
 await page.locator('#closePanel').click();
 await page.evaluate(()=>aiSocket.emit({type:'AI_GREETING',staffId:'ai-jax',residentId:'jax',text:'UNSOLICITED_TEST_GREETING'}));
 expect(await page.evaluate(()=>aiRenderer.bubbles.has('ai-jax'))).toBe(false);expect(await page.evaluate(()=>({humans:aiRenderer.users.size,ai:[...aiRenderer.staff.values()].filter(s=>s.isAI).length}))).toEqual({humans:1,ai:1});
 await page.locator('[data-panel="rooms"]').click();await page.getByRole('button',{name:'Public Hangouts',exact:true}).click();await expect(page.locator('.room-card').filter({hasText:'Hotel Lobby'})).toContainText('5 Spuds here');await page.locator('#closePanel').click();
 const point=await page.evaluate(()=>{const r=aiRenderer,h=r.hit.find(h=>h.user.isAI);return {x:r.cx+h.x*r.scale,y:r.cy+(h.y+13)*r.scale};});await page.locator('#worldCanvas').click({position:point});await expect(page.locator('#panelTitle .resident-ai-badge')).toHaveText('AI resident');await expect.poll(()=>page.locator('.resident-portrait').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0))).toBe(true);
 await page.screenshot({path:info.outputPath('ai-spud-room.png')});await page.evaluate(()=>window.dispatchEvent(new Event('earnly-cloud-auth-change')));await expect(page.locator('#worldPanel')).not.toBeVisible();await expect(page.locator('#panelContent')).toBeEmpty();expect(await page.evaluate(()=>aiRenderer.bubbles.size)).toBe(0);expect(errors).toEqual([]);
});
test('AI friendship, consent, memory inspection and room invitations fit on a phone',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);await page.locator('[data-panel="staff"]').click();
 await page.getByRole('button',{name:'Meet resident',exact:true}).click();await page.getByRole('button',{name:'Friendship & saved memories',exact:true}).click();
 await expect(page.locator('#worldPanel')).toContainText('Memory is off');await expect(page.locator('#worldPanel')).toContainText('No raw conversation transcripts');
 await page.getByRole('button',{name:'Add friend',exact:true}).click();await expect(page.getByRole('button',{name:'Remove friend',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Turn memory on',exact:true}).click();await expect(page.locator('#worldPanel')).toContainText('Memory is on');
 await page.getByRole('button',{name:'Invite to this room',exact:true}).click();await expect(page.getByRole('button',{name:'Dismiss visitor',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Dismiss visitor',exact:true}).click();await expect(page.getByRole('button',{name:'Invite to this room',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Forget all memories & turn memory off',exact:true}).click();await expect(page.locator('#worldPanel')).toContainText('Memory is off');
 expect(await page.locator('#worldPanel').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await page.screenshot({path:info.outputPath('ai-spud-privacy.png')});
 expect(await page.evaluate(()=>aiActions.filter(a=>['resident_invite','resident_dismiss'].includes(a.action)).map(a=>a.action))).toEqual(['resident_invite','resident_dismiss']);
});
test('Guest catalog survives the initial auth notification before connecting',async({page})=>{
 await page.route('https://**',r=>r.abort());
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={};'}));
 await page.goto('/world.html?catalog=Bathroom');
 await expect(page.locator('#panelContent')).toContainText('Porcelain Toilet');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('earnly-cloud-auth-change',{detail:{event:'INITIAL_SESSION',session:null}})));
 await expect(page.locator('#worldPanel')).toBeVisible();
 await expect(page.locator('#panelContent')).toContainText('Porcelain Toilet');
});
