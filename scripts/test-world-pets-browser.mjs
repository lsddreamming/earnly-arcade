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
const root=fileURLToPath(new URL('../',import.meta.url));const fixture=await worldFixture({personalPets:true});
const tls=await mkdtemp(join(tmpdir(),'earnly-world-tls-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(tls,'key.pem'),'-out',join(tls,'cert.pem'),'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
const server=createServer({key:await readFile(join(tls,'key.pem')),cert:await readFile(join(tls,'cert.pem'))},async(req,res)=>{try{const file=join(root,req.url.split('?')[0]);res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'text/plain');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin='https://127.0.0.1:'+server.address().port;
const gateway=attachWorldGateway(server,new SupabaseWorldAccess('https://world-test.invalid','fixture-key'),new Set([origin]));
const browser=await chromium.launch({executablePath:process.env.WORLD_TEST_CHROMIUM||undefined,args:['--ignore-certificate-errors']});

let errors=[];
try{
 const home=(await fixture.db.query("select public.world_api($1,'create_room','{\"name\":\"Pet home\"}'::jsonb) r",[fixture.users[0]])).rows[0].r.roomId;
 const pages=[];
 for(const uid of fixture.users){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},hasTouch:true});const p=await context.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/world-renderer.js*',async r=>r.fulfill({contentType:'application/javascript',body:(await readFile(join(root,'world-renderer.js'),'utf8'))+';{const Base=EarnlyWorldRenderer.WorldRenderer;EarnlyWorldRenderer.WorldRenderer=class extends Base{constructor(...args){super(...args);window.testWorldRenderer=this;}};}'}));
  await p.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:`window.EarnlyCloud={session:async()=>({access_token:${JSON.stringify(uid)}})};`}));
  await p.route('**/world-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.EarnlyWorldConfig={endpoint:${JSON.stringify(origin.replace('https:','wss:')+'/world')}};`}));
  await p.goto(origin+'/world.html?room='+home);await expect(p.locator('#connectionStatus')).toContainText('Live');
 }
 const [owner,guest]=pages;
 await owner.locator('[data-panel="backpack"]').click();await owner.getByRole('button',{name:'Pets',exact:true}).click();await owner.getByRole('button',{name:'Pet Shop',exact:true}).click();
 for(const [name,price] of [['Cloud Pup',500],['Moon Cat',500],['Meadow Bunny',350]]){
  await owner.getByRole('button',{name:'Adopt '+name,exact:true}).click();await owner.getByRole('button',{name:'Adopt for '+price+' Coins',exact:true}).click();await expect(owner.locator('#panelTitle')).toHaveText('Your Pets');
  if(name!=='Meadow Bunny'){await owner.waitForTimeout(1100);await owner.getByRole('button',{name:'Pet Shop',exact:true}).click();}
 }
 await expect(owner.locator('#coinBalance')).toHaveText('◇ 1,650');await expect(owner.locator('.pet-card')).toHaveCount(3);
 await owner.waitForTimeout(1100);await owner.locator('.pet-card').filter({hasText:'Cloud Pup'}).getByRole('button',{name:'Rename',exact:true}).click();await owner.getByRole('textbox',{name:'Pet name',exact:true}).fill('Biscuit');await owner.getByRole('button',{name:'Save name',exact:true}).click();await expect(owner.locator('.pet-card').filter({hasText:'Biscuit'})).toHaveCount(1);
 for(const name of ['Biscuit','Moon Cat','Meadow Bunny']){
  await owner.waitForTimeout(1100);await owner.locator('.pet-card').filter({hasText:name}).getByRole('button',{name:'Place in room',exact:true}).click();await expect(owner.locator('#worldPanel')).not.toBeVisible();await owner.locator('[data-panel="backpack"]').click();await owner.getByRole('button',{name:'Pets',exact:true}).click();
 }
 await expect.poll(()=>guest.evaluate(()=>testWorldRenderer.staff.size)).toBe(3);
 await expect(owner.locator('#peopleCount')).toHaveAttribute('data-players','2');await expect(guest.locator('#peopleCount')).toHaveAttribute('data-players','2');
 await guest.locator('[data-panel="staff"]').click();await guest.locator('.panel-row').filter({hasText:'Biscuit'}).getByRole('button',{name:'Meet pet'}).click();await expect(guest.locator('#panelContent')).toContainText('Room companion');await expect(guest.getByRole('button',{name:'Manage my pets'})).toHaveCount(0);await expect(guest.getByRole('button',{name:'Call over',exact:true})).toHaveCount(0);await guest.locator('#closePanel').click();
 await owner.locator('#closePanel').click();
 const before=await guest.evaluate(()=>[...testWorldRenderer.staff.values()].map(p=>p.position));await expect.poll(()=>guest.evaluate(()=>[...testWorldRenderer.staff.values()].map(p=>p.position)),{timeout:65000,intervals:[1000]}).not.toEqual(before);
 await owner.locator('[data-panel="staff"]').click();await owner.locator('.panel-row').filter({hasText:'Biscuit'}).getByRole('button',{name:'Meet pet'}).click();await owner.getByRole('button',{name:'Call over',exact:true}).click();
 await expect.poll(()=>owner.evaluate(()=>{const r=testWorldRenderer,p=[...r.staff.values()].find(p=>p.username==='Biscuit'),u=r.users.get(r.localUserId);return Math.hypot(p.position.x-u.position.x,p.position.y-u.position.y);}),{timeout:30000,intervals:[500]}).toBeLessThanOrEqual(1.5);
 await owner.locator('[data-panel="staff"]').click();await owner.locator('.panel-row').filter({hasText:'Biscuit'}).getByRole('button',{name:'Meet pet'}).click();await owner.getByRole('button',{name:'Pet',exact:true}).click();
 for(const p of [owner,guest])await expect.poll(()=>p.evaluate(()=>{const r=testWorldRenderer,pet=[...r.staff.values()].find(p=>p.username==='Biscuit');return pet.happyUntil>performance.now()&&r.bubbles.get(pet.staffId)?.text==='♥';})).toBe(true);
 if(process.env.WORLD_TEST_SCREENSHOTS){await owner.screenshot({path:process.env.WORLD_TEST_SCREENSHOTS+'/personal-pets-room.png'});}
 await owner.reload();await expect.poll(()=>owner.evaluate(()=>testWorldRenderer.staff.size)).toBe(3);
 await owner.locator('[data-panel="backpack"]').click();await owner.getByRole('button',{name:'Pets',exact:true}).click();
 if(process.env.WORLD_TEST_SCREENSHOTS)await owner.screenshot({path:process.env.WORLD_TEST_SCREENSHOTS+'/personal-pets-backpack.png'});
 await owner.locator('.pet-card').filter({hasText:'Biscuit'}).getByRole('button',{name:'Return to Backpack',exact:true}).click();await expect.poll(()=>guest.evaluate(()=>testWorldRenderer.staff.size)).toBe(2);await expect(owner.locator('.pet-card').filter({hasText:'Biscuit'})).toContainText('In Backpack');
 await expect(owner.locator('#coinBalance')).toHaveText('◇ 1,650');expect(errors).toEqual([]);
 console.log('PASS: two connected mobile-size browsers adopt three species, debit exact prices, rename, place, see shared roaming, call over with safe pathfinding, share happy reactions, reconnect and pick up without losing ownership.');
}finally{await browser.close();await gateway.close();await new Promise(r=>server.close(r));await fixture.close();await rm(tls,{recursive:true,force:true});}
