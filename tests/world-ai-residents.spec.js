const {test,expect}=require('@playwright/test');
const liveWorldBase=process.env.EARNLY_WORLD_BASE_URL||'';
const liveWorldOrigin=liveWorldBase?new URL(liveWorldBase).origin:'';
async function fixture(page,{chatAccepted=true,roomWide=false}={}){
 await page.route(url=>url.protocol==='https:'&&url.origin!==liveWorldOrigin,r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EarnlyCloud={session:async()=>({access_token:"fixture"})};'}));
 await page.addInitScript(({chatAccepted,roomWide})=>{
  Object.defineProperty(window,'EarnlyWorldRenderer',{configurable:true,set(v){const Base=v.WorldRenderer;v.WorldRenderer=class extends Base{constructor(...args){super(...args);window.aiRenderer=this;}};Object.defineProperty(window,'EarnlyWorldRenderer',{value:v,writable:true,configurable:true});}});
  const room='00000000-0000-4000-8000-000000000001';window.aiActions=[];window.aiJoins=[];
  const residentHome={residentId:'jax',roomId:'ead10000-0000-4000-8000-000000000001',name:"Jax's Laugh Lounge",items:['Tidal Glass Aquarium','Sunset Sofa'],animatedFish:true};
  const state={quiet:false,remember:false,relations:[{residentId:'jax',friend:false,remember:false,visits:0,topics:[],roomVisits:[],achievements:[]}]};
  const ai={staffId:'ai-jax',residentId:'jax',username:'Jax',role:'comedian · AI resident',isAI:true,isStaff:true,position:{x:2,y:2,z:0},state:'dance',activity:'dancing',equipped:{avatar:{id:'russet-potato',imageUrl:'cosmetic-russet-potato.svg'},outfit:{imageUrl:'cosmetic-starter-suit.svg'},shoes:{imageUrl:'cosmetic-canvas-shoes.svg'}}};
  const staff={staffId:'staff-reception',username:'Pip',role:'Receptionist',isStaff:true,position:{x:4,y:4,z:0},state:'std'};
  const bootstrap={residentHomes:[residentHome],residentCatalog:[{id:'jax',name:'Jax'}],aiResidents:true,aiPublicChat:true,chatAccepted,aiMemory:true,residentQuiet:false,balance:2000,catalog:[],items:[],rooms:[{id:room,name:'Home',ownerId:'owner',occupancy:1,residentCount:1,spudCount:2},{id:'lobby',name:'Hotel Lobby',ownerId:null,occupancy:0,residentCount:5,spudCount:5}],friends:[]};
  window.WebSocket=class{static OPEN=1;events={};addEventListener(n,f){(this.events[n]??=[]).push(f);}removeEventListener(n,f){this.events[n]=(this.events[n]||[]).filter(x=>x!==f);}close(){this.readyState=3;for(const f of this.events.close||[])f();}constructor(){this.readyState=1;window.aiSocket=this;setTimeout(()=>this.onopen?.(),10);}emit(p){const e={data:JSON.stringify(p)};this.onmessage?.(e);for(const f of this.events.message||[])f(e);}send(raw){const p=JSON.parse(raw);if(p.type==='LEAVE'){this.emit({type:'LEFT'});return;}if(p.type==='JOIN'){window.aiJoins.push(p.roomId);const visiting=p.roomId===residentHome.roomId;this.emit({type:'WELCOME',userId:'owner',scene:{roomId:visiting?residentHome.roomId:room,name:visiting?residentHome.name:'Home',ownerId:visiting?null:'owner',residentHost:visiting?'jax':undefined,chatRange:visiting||roomWide?'room':'nearby',heightmap:Array(8).fill('00000000').join('\n'),items:visiting?[{id:'tank',definitionId:'collector-aquarium',name:'Tidal Glass Aquarium',sprite:'show-aquarium',color:'#7faea7',x:5,y:1,z:0,width:2,length:1,itemHeight:1.5,rotation:0}]:[]},bootstrap});this.emit({type:'ROOM_SNAPSHOT',users:[{userId:'owner',username:'You',position:{x:1,y:2,z:0}}]});this.emit({type:'NPC_SNAPSHOT',staff:[staff,ai]});}
   if(p.type==='ACTION'){window.aiActions.push(p);let data=bootstrap;
    if(p.action==='say'){this.emit({type:'CHAT',userId:'ai-jax',residentId:'jax',username:'Jax',isAI:true,text:'Why did the Spud bring a ladder? To reach the next level.',mode:'normal'});data={};}
    if(p.action==='room_directory')data=bootstrap.rooms;
    if(p.action==='resident_focus')data={ready:window.aiFocusReady!==false};
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
 },{chatAccepted,roomWide});
 await page.goto(liveWorldBase+'/world.html');await page.locator('#connectWorld').click();await expect(page.locator('#connectionStatus')).toContainText('Live');
}
test('AI residents have distinct actions, shared public chat and Quiet mode with a Spud headcount and separate human occupancy',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await fixture(page);
 await expect(page.locator('#peopleCount')).toHaveText('2 Spuds here');
 await page.locator('[data-panel="staff"]').click();await expect(page.getByRole('button',{name:'Say hello',exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'Meet resident',exact:true}).click();await expect(page.locator('#panelTitle')).toContainText('Jax');await expect(page.locator('#panelTitle .resident-ai-badge')).toHaveText('AI resident');await expect(page.locator('.resident-portrait')).toBeVisible();await expect(page.locator('#panelContent')).toContainText('Everyone within 8 tiles can join');
 await page.getByRole('button',{name:'Talk in nearby chat',exact:true}).click();await expect(page.locator('#worldPanel')).not.toBeVisible();await page.locator('#sayText').fill('Jax tell me a joke');await page.locator('#sayForm button').click();await expect.poll(()=>page.evaluate(()=>aiRenderer.bubbles.get('ai-jax')?.text)).toContain('To reach the next level');expect(await page.evaluate(()=>aiActions.filter(a=>a.action==='say').at(-1).data)).toMatchObject({text:'Jax tell me a joke',mode:'normal',residentId:'jax'});expect(await page.evaluate(()=>aiActions.some(a=>a.action==='resident_chat'))).toBe(false);await page.locator('[data-panel="staff"]').click();await page.getByRole('button',{name:'Meet resident',exact:true}).click();
 await page.getByRole('button',{name:'Social settings',exact:true}).click();expect(await page.evaluate(()=>aiActions.some(a=>a.action==='resident_focus'&&a.data.active===false))).toBe(true);await page.getByRole('button',{name:'Switch to Quiet mode',exact:true}).click();await expect(page.getByRole('button',{name:'Switch to Natural mode',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>aiActions.find(a=>a.action==='resident_mode').data.quiet)).toBe(true);
 await page.locator('#closePanel').click();
 await page.evaluate(()=>aiSocket.emit({type:'AI_GREETING',staffId:'ai-jax',residentId:'jax',text:'UNSOLICITED_TEST_GREETING'}));
 expect(await page.evaluate(()=>aiRenderer.bubbles.get('ai-jax')?.text)).not.toBe('UNSOLICITED_TEST_GREETING');expect(await page.evaluate(()=>({humans:aiRenderer.users.size,ai:[...aiRenderer.staff.values()].filter(s=>s.isAI).length}))).toEqual({humans:1,ai:1});
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

test('resident chat waits for approach and closing the panel releases the conversation',async({page})=>{
 await fixture(page);await page.evaluate(()=>window.aiFocusReady=false);
 await page.locator('[data-panel="staff"]').click();await page.getByRole('button',{name:'Meet resident',exact:true}).click();
 await expect(page.locator('#panelContent')).toContainText('Walking over to Jax');await expect(page.getByRole('button',{name:'Talk in nearby chat',exact:true})).toBeDisabled();
 await page.evaluate(()=>window.aiFocusReady=true);await expect(page.getByRole('button',{name:'Talk in nearby chat',exact:true})).toBeEnabled();
 await page.locator('#closePanel').click();await expect.poll(()=>page.evaluate(()=>aiActions.filter(a=>a.action==='resident_focus').at(-1)?.data.active)).toBe(false);
});

test('joining resident public chat requires explicit chat consent and keeps the conversation hold',async({page})=>{
 await fixture(page,{chatAccepted:false});await page.locator('[data-panel="staff"]').click();await page.getByRole('button',{name:'Meet resident',exact:true}).click();
 await page.getByRole('button',{name:'Talk in nearby chat',exact:true}).click();await expect(page.locator('#panelTitle')).toHaveText('Nearby chat rules');await expect(page.locator('#panelContent')).toContainText('sent to OpenAI');
 expect(await page.evaluate(()=>aiActions.some(a=>a.action==='accept_chat'))).toBe(false);
 await page.getByRole('button',{name:'I agree · Join nearby chat',exact:true}).click();await expect(page.locator('#worldPanel')).not.toBeVisible();
 expect(await page.evaluate(()=>aiActions.some(a=>a.action==='accept_chat'))).toBe(true);expect(await page.evaluate(()=>aiActions.filter(a=>a.action==='resident_focus').at(-1).data.active)).toBe(true);
 await page.locator('#sayText').fill('Hello Jax');await page.locator('#sayForm button').click();await expect.poll(()=>page.evaluate(()=>aiActions.filter(a=>a.action==='say').length)).toBe(1);
});

test('AI outage status is an honest toast rather than a fabricated resident reply',async({page})=>{
 await fixture(page);await page.evaluate(()=>aiSocket.emit({type:'RESIDENT_STATUS',status:'unavailable'}));
 await expect(page.locator('#worldToast')).toContainText('AI chat is unavailable');
 expect(await page.evaluate(()=>aiRenderer.bubbles.get('ai-jax')?.text)).toBeUndefined();
});

test('resident homes are optional, visit only on click, and fit on a phone',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);
 expect(await page.evaluate(()=>aiJoins.length)).toBe(1);
 await page.locator('[data-panel="staff"]').click();await page.getByRole('button',{name:'Meet resident',exact:true}).click();
 await page.getByRole('button',{name:'About my room',exact:true}).click();await expect(page.locator('#panelTitle')).toHaveText("Jax's Laugh Lounge");
 await expect(page.locator('#panelContent')).toContainText('swimming fish and bubbles');expect(await page.evaluate(()=>aiJoins.length)).toBe(1);
 expect(await page.locator('#worldPanel').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await page.getByRole('button',{name:'Visit room',exact:true}).click();await expect(page.locator('#roomName')).toHaveText("Jax's Laugh Lounge");await expect(page.locator('#roomKind')).toHaveText('AI RESIDENT HOME');await expect(page.locator('#renameRoom')).toBeHidden();
 expect(await page.evaluate(()=>aiActions.some(a=>a.action==='buy'))).toBe(false);expect(await page.evaluate(()=>aiRenderer.canEditItem({id:'tank'}))).toBe(false);
 await page.screenshot({path:info.outputPath('resident-home-phone.png')});
});


test('personal room chat labels and consent explain all-tile conversation on phones',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,{chatAccepted:false,roomWide:true});
 await expect(page.locator('#sayText')).toHaveAttribute('placeholder','Say hello to everyone in the room…');
 await page.locator('[data-panel="staff"]').click();await page.getByRole('button',{name:'Meet resident',exact:true}).click();
 await expect(page.locator('#panelContent')).toContainText('Everyone in this room can join');
 await page.getByRole('button',{name:'Talk in room chat',exact:true}).click();
 await expect(page.locator('#panelTitle')).toHaveText('Room chat rules');await expect(page.locator('#panelContent')).toContainText('public throughout this room');
 await expect(page.locator('#panelContent')).toContainText('private messages and saved memories are excluded');
 await page.getByRole('button',{name:'I agree · Join room chat',exact:true}).click();await expect(page.locator('#worldPanel')).not.toBeVisible();
 await page.locator('[data-panel="chat"]').click();await expect(page.locator('#panelContent')).toContainText('Room chat · All tiles');
 expect(await page.locator('#worldPanel').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});
