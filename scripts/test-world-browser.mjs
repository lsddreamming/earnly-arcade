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
 const pages=[];for(const uid of fixture.users){const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/world-renderer.js',async r=>r.fulfill({contentType:'application/javascript',body:(await readFile(join(root,'world-renderer.js'),'utf8'))+';{const Base=EarnlyWorldRenderer.WorldRenderer;EarnlyWorldRenderer.WorldRenderer=class extends Base{constructor(...args){super(...args);window.testWorldRenderer=this;}};}'}));
 await p.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:`window.EarnlyCloud={session:async()=>({access_token:${JSON.stringify(uid)}})};`}));
 await p.route('**/world-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.EarnlyWorldConfig={endpoint:${JSON.stringify(origin.replace('https:','wss:')+'/world')}};`}));
 await p.route('https://*.supabase.co/**',r=>r.fulfill({status:404,body:''}));await p.goto(origin+'/world.html');await p.locator('#connectionStatus').filter({hasText:'Live'}).waitFor();pages.push(p);}
 const [a,b]=pages;await a.locator('#peopleCount').filter({hasText:'2 in'}).waitFor();
 for(const p of pages){await p.getByRole('button',{name:'Chat',exact:false}).click();await p.getByRole('button',{name:'I agree to the chat rules'}).click();await p.getByRole('button',{name:'Close panel'}).click();}
 await a.locator('#sayText').fill('Hello from my potato');await a.locator('#sayForm button').click();await b.getByRole('button',{name:'Chat',exact:false}).click();await b.locator('.chat-message').filter({hasText:'Hello from my potato'}).waitFor();await b.getByRole('button',{name:'Close panel'}).click();
 await a.getByRole('button',{name:'Catalog',exact:false}).click();await a.locator('.item-card').filter({hasText:'Moon Fern'}).getByRole('button').click();await a.getByRole('button',{name:'Buy for ◇ 70'}).click();await a.locator('.item-card').filter({hasText:'Moon Fern'}).waitFor();
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
 await a.getByRole('button',{name:'Close panel'}).click();await a.getByRole('button',{name:'Rooms',exact:false}).click();await a.getByPlaceholder('Name your new room').fill('Potato Studio');await a.getByRole('button',{name:'Create',exact:true}).click();await a.locator('#roomName').filter({hasText:'Potato Studio'}).waitFor();
 await a.getByRole('button',{name:'Backpack',exact:false}).click();await a.locator('.item-card').filter({hasText:'Moon Fern'}).getByRole('button',{name:'Place',exact:true}).click();await a.locator('#placementHint').waitFor();
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
 await tapFern();await a.getByRole('button',{name:'Return to Backpack',exact:true}).click();await expect.poll(fern).toBeUndefined();
 await a.getByRole('button',{name:'Backpack',exact:false}).click();await expect(a.locator('.item-card').filter({hasText:'Moon Fern'})).toContainText('In Backpack');
 if(errors.length)throw new Error(errors.join(';'));
 console.log('Browser integration passed: two saved avatars, chat, catalog purchase, trade-offer unlocks, personal room, placement, direct furniture selection, repeated movement, rotation, cancellation and pickup.');

}finally{await browser.close();await gateway.close();await new Promise(r=>server.close(r));await fixture.close();await rm(tls,{recursive:true,force:true});}
