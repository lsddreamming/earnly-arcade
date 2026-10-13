import {createServer} from 'node:https';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {extname,join} from 'node:path';
import {once} from 'node:events';
import {chromium} from 'playwright';
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
 await p.route('**/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:`window.EarnlyCloud={session:async()=>({access_token:${JSON.stringify(uid)}})};`}));
 await p.route('**/world-config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.EarnlyWorldConfig={endpoint:${JSON.stringify(origin.replace('https:','wss:')+'/world')}};`}));
 await p.route('https://*.supabase.co/**',r=>r.fulfill({status:404,body:''}));await p.goto(origin+'/world.html');await p.locator('#connectionStatus').filter({hasText:'Live'}).waitFor();pages.push(p);}
 const [a,b]=pages;await a.locator('#peopleCount').filter({hasText:'2 in'}).waitFor();
 for(const p of pages){await p.getByRole('button',{name:'Chat',exact:false}).click();await p.getByRole('button',{name:'I agree to the chat rules'}).click();await p.getByRole('button',{name:'Close panel'}).click();}
 await a.locator('#sayText').fill('Hello from my potato');await a.locator('#sayForm button').click();await b.getByRole('button',{name:'Chat',exact:false}).click();await b.locator('.chat-message').filter({hasText:'Hello from my potato'}).waitFor();await b.getByRole('button',{name:'Close panel'}).click();
 await a.getByRole('button',{name:'Catalog',exact:false}).click();await a.locator('.item-card').filter({hasText:'Moon Fern'}).getByRole('button').click();await a.getByRole('button',{name:'Buy for ◇ 70'}).click();await a.locator('.item-card').filter({hasText:'Moon Fern'}).waitFor();
 await a.getByRole('button',{name:'Close panel'}).click();await a.getByRole('button',{name:'Rooms',exact:false}).click();await a.getByPlaceholder('Name your new room').fill('Potato Studio');await a.getByRole('button',{name:'Create',exact:true}).click();await a.locator('#roomName').filter({hasText:'Potato Studio'}).waitFor();
 await a.getByRole('button',{name:'Backpack',exact:false}).click();await a.locator('.item-card').filter({hasText:'Moon Fern'}).getByRole('button',{name:'Place',exact:true}).click();await a.locator('#placementHint').waitFor();
 // Tile is selected through the actual canvas, not by a direct API operation.
 const box=await a.locator('#worldCanvas').boundingBox();await a.locator('#worldCanvas').click({position:{x:box.width/2,y:box.height/2+30}});await a.locator('#worldToast').filter({hasText:'Placed in your room'}).waitFor();
 if(errors.length)throw new Error(errors.join(';'));
 console.log('Browser integration passed: two saved avatars, chat, catalog purchase, personal room, Backpack placement.');

}finally{await browser.close();await gateway.close();await new Promise(r=>server.close(r));await fixture.close();await rm(tls,{recursive:true,force:true});}
