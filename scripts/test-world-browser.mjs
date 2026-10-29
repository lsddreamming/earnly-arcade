import {createServer} from 'node:https';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {extname,join} from 'node:path';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import {worldFixture} from './world-test-fixture.mjs';
import {attachWorldGateway} from '../world-server/src/gateway.ts';
import {SupabaseWorldAccess} from '../world-server/src/supabase-access.ts';
const root=fileURLToPath(new URL('../',import.meta.url));const fixture=await worldFixture();
const tls=await mkdtemp(join(tmpdir(),'earnly-world-tls-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(tls,'key.pem'),'-out',join(tls,'cert.pem'),'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
const server=createServer({key:await readFile(join(tls,'key.pem')),cert:await readFile(join(tls,'cert.pem'))},async(req,res)=>{try{const file=join(root,req.url.split('?')[0]);res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'text/plain');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin='https://127.0.0.1:'+server.address().port;
const gateway=attachWorldGateway(server,new SupabaseWorldAccess('https://world-test.invalid','fixture-key'),new Set([origin]));
const browser=await chromium.launch({executablePath:process.env.WORLD_TEST_CHROMIUM||undefined,args:['--ignore-certificate-errors']});
let errors=[];
try{
 const pages=[];for(const uid of fixture.users){const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},hasTouch:true});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/world-renderer.js*',async r=>r.fulfill({contentType:'application/javascript',body:(await readFile(join(root,'world-renderer.js'),'utf8'))+';{const Base=EarnlyWorldRenderer.WorldRenderer;EarnlyWorldRenderer.WorldRenderer=class extends Base{constructor(...args){super(...args);window.testWorldRenderer=this;}};}'}));
 await p.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:`window.EarnlyCloud={session:async()=>({access_token:${JSON.stringify(uid)}})};`}));
 await p.route('**/world-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.EarnlyWorldConfig={endpoint:${JSON.stringify(origin.replace('https:','wss:')+'/world')}};`}));
 await p.route('https://*.supabase.co/**',r=>r.fulfill({status:404,body:''}));await p.goto(origin+'/world.html');await p.locator('#connectWorld').click();await expect(p.locator('#panelTitle')).toHaveText('Choose your first room');
 await expect(p.locator('.room-layout-card')).toHaveCount(5);
 if(process.env.WORLD_TEST_SCREENSHOTS)await p.screenshot({path:process.env.WORLD_TEST_SCREENSHOTS+'/room-picker-'+pages.length+'.png'});
 await p.getByRole('button',{name:pages.length?'Split-Level Suite':'Cozy Studio',exact:true}).click();
 await p.getByRole('button',{name:/^Start in /}).click();
 await p.locator('#connectionStatus').filter({hasText:'Live'}).waitFor();
 if(process.env.WORLD_TEST_SCREENSHOTS)await p.screenshot({path:process.env.WORLD_TEST_SCREENSHOTS+'/starter-room-'+pages.length+'.png'});pages.push(p);}
 const [a,b]=pages;
 // Distant floor and furniture targets are reachable through the visible overview.
 const overview=async p=>{await p.locator('#roomView').click();await expect(p.locator('#roomView')).toHaveAttribute('aria-pressed','true');await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
 await overview(b);
 // Walk down and back up the actual split-level room using projected floor clicks.
 for(const target of [{x:3,y:12,z:0},{x:3,y:2,z:2}]){
  const point=await b.evaluate(p=>{const r=window.testWorldRenderer;const x=(p.x-p.y)*18,y=(p.x+p.y)*9-p.z*12+9;const hit=r.floorAt(x,y);if(hit?.x!==p.x||hit?.y!==p.y)throw new Error('Raised floor hit mismatch');return {x:r.cx+x*r.scale,y:r.cy+y*r.scale};},target);
  await b.locator('#worldCanvas').click({position:point});
  await expect.poll(()=>b.evaluate(uid=>window.testWorldRenderer.users.get(uid)?.position,fixture.users[1]),{timeout:15000}).toEqual(target);
 }
 if(process.env.WORLD_TEST_SCREENSHOTS)await b.screenshot({path:process.env.WORLD_TEST_SCREENSHOTS+'/split-level-stairs.png'});

 // First-time accounts spawn directly into their own public room.
 for(const [index,p] of pages.entries()){
  await expect(p.locator('#roomKind')).toHaveText('YOUR PERSONAL SPACE');
  await expect.poll(()=>p.evaluate(()=>window.testWorldRenderer.scene.ownerId)).toBe(fixture.users[index]);
  await expect(p.locator('#peopleCount')).toHaveAttribute('data-players','1');
  const homeId=await p.evaluate(()=>window.testWorldRenderer.scene.roomId);await p.reload();await expect(p.locator('#worldConnected')).toBeHidden();await p.locator('#connectWorld').click();await expect(p.locator('#connectionStatus')).toContainText('Live');
  await expect.poll(()=>p.evaluate(()=>window.testWorldRenderer.scene.roomId)).toBe(homeId);
  await expect(p.locator('#worldPanel')).not.toBeVisible();
  await p.locator('[data-panel="rooms"]').click();await p.getByRole('button',{name:'Public Hangouts',exact:true}).click();await p.locator('.room-card').filter({hasText:'Earnly Plaza'}).getByRole('button',{name:'Visit →'}).click();
  await expect(p.locator('#roomName')).toHaveText('Earnly Plaza');
 }
 await expect(a.locator('#peopleCount')).toHaveAttribute('data-players','2');
 // Visit each real persisted public room and interact through the visible staff UI.
 for(const [name,role] of [['Hotel Lobby','Receptionist'],['Rooftop Lounge','Bartender'],['Patio Hangout','Patio host']]){
  await a.locator('[data-panel="rooms"]').click();await a.getByRole('button',{name:'Public Hangouts',exact:true}).click();await a.locator('.room-card').filter({hasText:name}).getByRole('button',{name:'Visit →'}).click();
  await expect(a.locator('#roomName')).toHaveText(name);await overview(a);await expect(a.locator('#peopleCount')).toHaveAttribute('data-players','1');
  await a.locator('[data-panel="staff"]').click();await a.getByRole('button',{name:'Say hello',exact:true}).click();await expect(a.locator('#panelTitle')).toContainText(role);await expect(a.locator('#panelContent')).toContainText('Staff NPC');
  await a.getByRole('button',{name:role==='Bartender'?'See the mocktail menu':'Ask for a local tip'}).click();await expect(a.locator('.staff-reply')).toBeVisible();await expect(a.getByRole('button',{name:'Find me a seat'})).toBeVisible();
  await expect(a.getByRole('button',{name:'Trade decor',exact:true})).toHaveCount(0);await a.getByRole('button',{name:'Close panel'}).click();
  // Tap actual seat sprite pixels, including the raised back, automatically walk over and sit without a dialog.
  const seatPoint=await a.evaluate(()=>{
   const r=window.testWorldRenderer;
   const blocked=(x,y)=>r.hit.some(h=>Math.abs(x-h.x)<Math.max(20,(h.nameWidth||0)/2)&&y>h.y-50&&y<h.y+(h.user.isAI?24:4));
   const seats=r.scene.items.filter(i=>i.canSit&&![...r.staff.values()].some(s=>s.isAI&&s.itemId===i.id)&&![...r.users.values(),...r.staff.values()].some(u=>u.position.x===i.x&&u.position.y===i.y));
   const pick=(i,x,y)=>{if(blocked(x,y)||r.pickItem(x,y,[i])?.id!==i.id||r.pickItem(x,y)?.id!==i.id)return null;return {x:r.cx+x*r.scale,y:r.cy+y*r.scale};};
   // Prefer a handful of visible surface points across all seats before raster scanning.
   for(const i of seats){const ox=(i.x-i.y)*18,oy=(i.x+i.y)*9-i.z*12;for(const [dx,dy]of [[0,-12],[0,-20],[8,-12],[-8,-12],[0,-4],[8,4],[-8,4]]){const hit=pick(i,ox+dx,oy+dy);if(hit)return hit;}}
   for(const i of seats){const ox=(i.x-i.y)*18,oy=(i.x+i.y)*9-i.z*12;for(let y=oy-30;y<oy+18;y+=2)for(let x=ox-30;x<ox+40;x+=2){const hit=pick(i,x,y);if(hit)return hit;}}
   throw new Error('No unobscured seat sprite found');
  });
  await a.locator('#worldCanvas').click({position:seatPoint});await expect(a.getByRole('button',{name:'Move',exact:true})).toHaveCount(0);
  await expect(a.locator('#worldPanel')).not.toBeVisible();
  await expect(a.locator('#connectionStatus')).toContainText('Sitting',{timeout:15000});
  await expect.poll(()=>a.evaluate(uid=>window.testWorldRenderer.users.get(uid)?.state,fixture.users[0])).toBe('sit');
  if(process.env.WORLD_TEST_SCREENSHOTS)await a.screenshot({path:process.env.WORLD_TEST_SCREENSHOTS+'/'+name.replaceAll(' ','-')+'-seated.png'});
  const floorPoint=await a.evaluate(()=>{const r=window.testWorldRenderer,me=r.users.get(r.localUserId).position,tiles=[];for(let y=0;y<12;y++)for(let x=0;x<12;x++)tiles.push({x,y});tiles.sort((a,b)=>Math.abs(a.x-me.x)+Math.abs(a.y-me.y)-Math.abs(b.x-me.x)-Math.abs(b.y-me.y));for(const {x,y}of tiles){const px=(x-y)*18,py=(x+y)*9+9;if(r.pickItem(px,py)||r.hit.some(h=>Math.abs(px-h.x)<Math.max(20,(h.nameWidth||0)/2)&&py>h.y-50&&py<h.y+(h.user.isAI?24:4)))continue;return {tile:{x,y},point:{x:r.cx+px*r.scale,y:r.cy+py*r.scale}};}throw new Error('No clear floor pixel');});
  await a.locator('#worldCanvas').click({position:floorPoint.point});
  await expect.poll(()=>a.evaluate(uid=>{const u=window.testWorldRenderer.users.get(uid);return [u.position.x,u.position.y,u.state];},fixture.users[0]),{timeout:15000}).toEqual([floorPoint.tile.x,floorPoint.tile.y,'std']);
  if(process.env.WORLD_TEST_SCREENSHOTS)await a.screenshot({path:process.env.WORLD_TEST_SCREENSHOTS+'/'+name.replaceAll(' ','-')+'.png'});
 }
 await a.locator('[data-panel="rooms"]').click();await a.getByRole('button',{name:'Public Hangouts',exact:true}).click();await a.locator('.room-card').filter({hasText:'Earnly Plaza'}).getByRole('button',{name:'Visit →'}).click();
 await expect(a.locator('#roomName')).toHaveText('Earnly Plaza');await overview(a);await expect.poll(()=>a.evaluate(()=>[...window.testWorldRenderer.staff.values()].filter(s=>!s.isAI).length)).toBe(0);await expect.poll(()=>a.evaluate(()=>[...window.testWorldRenderer.staff.values()].filter(s=>s.isAI).length)).toBeGreaterThanOrEqual(5);await expect.poll(()=>a.evaluate(()=>window.testWorldRenderer.staff.size)).toBeLessThanOrEqual(10);
 await expect(a.locator('#peopleCount')).toHaveAttribute('data-players','2');

 for(const p of pages){await p.getByRole('button',{name:'Chat',exact:false}).click();await p.getByRole('button',{name:'I agree to the chat rules'}).click();await p.getByRole('button',{name:'Close panel'}).click();}
 await a.locator('#sayText').fill('Hello from my potato');await a.locator('#sayForm button').click();await b.getByRole('button',{name:'Chat',exact:false}).click();await b.locator('.chat-message').filter({hasText:'Hello from my potato'}).waitFor();await b.getByRole('button',{name:'Close panel'}).click();
 await a.getByRole('button',{name:'Catalog',exact:false}).click();
 await expect(a.locator('.item-card')).toHaveCount(35);
 await a.getByRole('button',{name:'Heritage',exact:true}).click();
 await expect(a.locator('.item-card')).toHaveCount(5);
 if(process.env.WORLD_TEST_SCREENSHOTS)await a.screenshot({path:process.env.WORLD_TEST_SCREENSHOTS+'/heritage-catalog.png'});
 await a.getByRole('button',{name:'Garden',exact:true}).click();
 await expect(a.locator('.item-card')).toHaveCount(9);
 if(process.env.WORLD_TEST_SCREENSHOTS)await a.screenshot({path:process.env.WORLD_TEST_SCREENSHOTS+'/garden-catalog.png'});
 await a.getByRole('button',{name:'All',exact:true}).click();
await a.getByRole('button',{name:'Preview Moon Fern',exact:true}).click();await a.getByRole('button',{name:'Rotate preview'}).click();await a.getByRole('button',{name:'Choose this piece',exact:true}).click();await a.getByRole('button',{name:'Buy for ◇ 70'}).click();await a.locator('.item-card').filter({hasText:'Moon Fern'}).waitFor();
 await a.getByRole('button',{name:'Close panel'}).click();
 // Start a trade by tapping the other saved avatar in the real canvas.
 const target=await a.evaluate(uid=>{const r=window.testWorldRenderer,h=r.hit.find(h=>h.user.userId===uid);return {x:r.cx+h.x*r.scale,y:r.cy+(h.y-25)*r.scale};},fixture.users[1]);
 await a.locator('#worldCanvas').click({position:target});await a.getByRole('button',{name:'Trade decor',exact:true}).click();
 const confirmation=p=>p.getByRole('button',{name:'Confirm exchange',exact:true});
 await expect(confirmation(a)).toBeDisabled();
 // Pace intentional writes below the production account rate limit.
 await a.waitForTimeout(1100);
 await a.getByRole('checkbox',{name:/Moon Fern/}).check();
 await expect(b.locator('.trade-offers')).toContainText('Moon Fern');
 await a.getByRole('button',{name:'Lock my offer'}).click();await expect(confirmation(a)).toBeDisabled();
 await b.getByRole('button',{name:'Lock my offer'}).click();await expect(confirmation(a)).toBeEnabled();await expect(confirmation(b)).toBeEnabled();
 await a.getByRole('checkbox',{name:/Moon Fern/}).uncheck();
 await expect(confirmation(a)).toBeDisabled();await expect(confirmation(b)).toBeDisabled();
 await expect(b.locator('.trade-offers')).not.toContainText('Moon Fern');
 await expect(a.getByRole('button',{name:'Lock my offer'})).toBeEnabled();await expect(b.getByRole('button',{name:'Lock my offer'})).toBeEnabled();
 await a.getByRole('button',{name:'Cancel trade',exact:true}).click();await expect(b.locator('#panelContent')).toContainText('This trade was cancelled.');
 await a.getByRole('button',{name:'Close panel'}).click();await a.locator('[data-panel="rooms"]').click();await a.getByRole('button',{name:'＋ Create room · Free',exact:true}).click();await a.getByRole('button',{name:'Grand Square',exact:true}).click();await a.getByLabel('Room name',{exact:true}).fill('Potato Studio');await a.waitForTimeout(1100); // Keep the preceding rapid trade + directory actions below the production rate limit.
 await a.getByRole('button',{name:'Create Grand Square · Free',exact:true}).click();await a.locator('#roomName').filter({hasText:'Potato Studio'}).waitFor();await overview(a);
 await a.locator('[data-panel="backpack"]').click();await a.locator('.item-card').filter({hasText:'Moon Fern'}).getByRole('button',{name:'Place',exact:true}).click();await a.locator('#placementHint').waitFor();
 // Tile is selected through the actual canvas, not by a direct API operation.
 const box=await a.locator('#worldCanvas').boundingBox();await a.locator('#worldCanvas').click({position:{x:box.width/2,y:box.height/2+30}});await a.locator('#worldToast').filter({hasText:'Placed in your room'}).waitFor();
 // Furniture can be selected directly from its visible sprite, moved repeatedly,
 // rotated in place, cancelled without a write, and returned to the Backpack.
 const fern=()=>a.evaluate(()=>window.testWorldRenderer.scene.items.find(i=>i.name==='Moon Fern'));
 const tapFern=async()=>{
  await a.waitForTimeout(1100); // Respect the live action-rate limit between edits.
  const point=await a.evaluate(()=>{const r=window.testWorldRenderer,i=r.scene.items.find(i=>i.name==='Moon Fern');return {x:r.cx+(i.x-i.y)*18*r.scale,y:r.cy+((i.x+i.y)*9-i.z*12-6)*r.scale};});
  await a.locator('#worldCanvas').click({position:point});await expect(a.locator('#panelTitle')).toHaveText('Moon Fern');
 };
 const tapTile=async(x,y)=>{const point=await a.evaluate(({x,y})=>{const r=window.testWorldRenderer;return {x:r.cx+(x-y)*18*r.scale,y:r.cy+((x+y)*9+9)*r.scale};},{x,y});await a.locator('#worldCanvas').click({position:point});};
 await tapFern();await a.getByRole('button',{name:'Move',exact:true}).click();await tapTile(2,2);
 await expect.poll(async()=>{const i=await fern();return [i.x,i.y];}).toEqual([2,2]);
 await tapFern();await a.getByRole('button',{name:'Rotate ↻',exact:true}).click();await expect.poll(async()=>(await fern()).rotation).toBe(2);
 await tapFern();await a.getByRole('button',{name:'Move',exact:true}).click();await a.locator('#cancelPlace').click();
 {const i=await fern();expect([i.x,i.y,i.rotation]).toEqual([2,2,2]);}
 await tapFern();await a.getByRole('button',{name:'Move',exact:true}).click();await tapTile(3,2);
 await expect.poll(async()=>{const i=await fern();return [i.x,i.y,i.rotation];}).toEqual([3,2,2]);
 // Real touch double-taps and finger sliding: no write until a valid drop.
 await a.waitForTimeout(1100);
 const touchPoint=async()=>a.evaluate(()=>{const r=window.testWorldRenderer,i=r.scene.items.find(i=>i.name==='Moon Fern'),b=r.canvas.getBoundingClientRect();return {x:b.left+r.cx+(i.x-i.y)*18*r.scale,y:b.top+r.cy+((i.x+i.y)*9-i.z*12-6)*r.scale};});
 const doubleTouch=async p=>{await a.touchscreen.tap(p.x,p.y);await a.touchscreen.tap(p.x,p.y);};
 const initial=await fern();let finger=await touchPoint();await doubleTouch(finger);
 await expect.poll(()=>a.evaluate(()=>!!window.testWorldRenderer.placement)).toBe(true);
 await expect(a.locator('#worldPanel')).not.toBeVisible();
 const cdp=await a.context().newCDPSession(a);
 const slide=async(dx,dy)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});finger={x:finger.x+dx,y:finger.y+dy};await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 // Slide well beyond usable floor: red preview, no drop, no camera pan.
 const dragDistance=await a.evaluate(()=>180*window.testWorldRenderer.scale);
 await slide(-dragDistance,0);
 await expect.poll(()=>a.evaluate(()=>window.testWorldRenderer.placement.valid)).toBe(false);
 await doubleTouch(finger);await expect.poll(fern).toEqual(initial);
 expect(await a.evaluate(()=>window.testWorldRenderer.offset)).toEqual({x:0,y:0});
 // Move back onto free floor; release alone still does not save.
 await slide(dragDistance,32);
 await expect.poll(()=>a.evaluate(()=>window.testWorldRenderer.placement.valid)).toBe(true);
 const destination=await a.evaluate(()=>{const p=window.testWorldRenderer.placement;return [p.x,p.y];});
 expect(await fern()).toEqual(initial);await doubleTouch(finger);
 await expect.poll(async()=>{const i=await fern();return [i.x,i.y];}).toEqual(destination);
 await expect.poll(()=>a.evaluate(()=>window.testWorldRenderer.placement)).toBeNull();
 // Cancellation discards the preview without changing the saved furniture.
 await a.waitForTimeout(1100);finger=await touchPoint();await doubleTouch(finger);await slide(20,0);
 await a.locator('#cancelPlace').click();await expect.poll(()=>a.evaluate(()=>window.testWorldRenderer.placement)).toBeNull();
 expect([ (await fern()).x,(await fern()).y ]).toEqual(destination);
 await cdp.detach();
 await tapFern();await a.getByRole('button',{name:'Return to Backpack',exact:true}).click();await expect.poll(fern).toBeUndefined();
 await a.locator('[data-panel="backpack"]').click();await expect(a.locator('.item-card').filter({hasText:'Moon Fern'})).toContainText('In Backpack');
 if(errors.length)throw new Error(errors.join(';'));
 console.log('Browser integration passed: two saved avatars, chat, catalog purchase, trade-offer unlocks, personal room, placement, direct furniture selection, repeated movement, rotation, cancellation and pickup.');

}finally{await browser.close();await gateway.close();await new Promise(r=>server.close(r));await fixture.close();await rm(tls,{recursive:true,force:true});}
