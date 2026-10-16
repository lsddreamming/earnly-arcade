import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {WebSocket} from '../world-server/node_modules/ws/wrapper.mjs';
import {worldFixture} from './world-test-fixture.mjs';
import {attachWorldGateway} from '../world-server/src/gateway.ts';
import {SupabaseWorldAccess} from '../world-server/src/supabase-access.ts';
const fixture=await worldFixture(),server=createServer();
const gateway=attachWorldGateway(server,new SupabaseWorldAccess('https://world-test.invalid','server-only-test'),new Set(['https://earnlyarcade.com']));
server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
const clients=[];
async function client(userId,roomId='plaza'){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/world`,{origin:'https://earnlyarcade.com'}),events=[],waiters=[];
 ws.on('message',buffer=>{const packet=JSON.parse(buffer);events.push(packet);for(const w of [...waiters])if(w.match(packet)){waiters.splice(waiters.indexOf(w),1);clearTimeout(w.timer);w.resolve(packet);}});
 const wait=match=>new Promise((resolve,reject)=>{const entry={match,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(entry),1);reject(new Error('Message timeout'));},6000)};waiters.push(entry);});
 await once(ws,'open');const welcome=wait(p=>p.type==='WELCOME');ws.send(JSON.stringify({type:'JOIN',version:1,token:userId,roomId}));const data=await welcome;
 const request=async(action,data={})=>{await new Promise(r=>setTimeout(r,220));const requestId=randomUUID(),reply=wait(p=>p.type==='RESULT'&&p.requestId===requestId);ws.send(JSON.stringify({type:'ACTION',requestId,action,data}));const p=await reply;if(p.error)throw new Error(p.error);return p.data;};
 const c={ws,events,wait,request,welcome:data};clients.push(c);return c;
}
try{
 const access=new SupabaseWorldAccess('https://world-test.invalid','server-only-test');
 await assert.rejects(access.enter({userId:fixture.users[0],username:'Player0'},'choose-home'),e=>e.reason==='room_choice_required');
 assert.equal((await fixture.db.query('select count(*)::int n from earnly_world.rooms where owner_id=$1',[fixture.users[0]])).rows[0].n,0);
 const homes=await Promise.all(fixture.users.map(id=>client(id,'starter-studio')));
 for(const [index,c] of homes.entries()){assert.equal(c.welcome.scene.ownerId,fixture.users[index]);assert.equal(c.welcome.scene.access,'open');const left=c.wait(p=>p.type==='LEFT');c.ws.send(JSON.stringify({type:'LEAVE'}));await left;}
 assert.notEqual(homes[0].welcome.roomId,homes[1].welcome.roomId);
 const [a,b]=await Promise.all(fixture.users.map(id=>client(id)));
 assert.equal(a.welcome.scene.equipped.avatar.id,'cyber-starter');
 await a.request('accept_chat');await b.request('accept_chat');
 const bubble=b.wait(p=>p.type==='CHAT');await a.request('say',{text:'Hello plaza',mode:'shout',requestId:randomUUID()});assert.equal((await bubble).text,'Hello plaza');
 await a.request('friend_request',{username:'Player1'});await b.request('friend_accept',{userId:fixture.users[0]});
 await fixture.db.query('update earnly_world.social_members set last_sent=null');
 const privateMessage=b.wait(p=>p.type==='PRIVATE');await a.request('private_send',{userId:fixture.users[1],text:'Hello friend',requestId:randomUUID()});assert.equal((await privateMessage).text,'Hello friend');
 const purchase=await a.request('buy',{definitionId:'fern',requestId:randomUUID()});
 const t=await a.request('trade_create',{userId:fixture.users[1]});
 await a.request('trade_action',{tradeId:t.id,revision:0,action:'edit',items:[purchase.item_id]});
 await a.request('trade_action',{tradeId:t.id,revision:1,action:'lock'});await b.request('trade_action',{tradeId:t.id,revision:1,action:'lock'});
 await a.request('trade_action',{tradeId:t.id,revision:1,action:'confirm'});await b.request('trade_action',{tradeId:t.id,revision:1,action:'confirm'});
 assert.ok((await b.request('bootstrap')).items.some(i=>i.id===purchase.item_id));
 const own=await a.request('create_room',{name:'Personal room'});const left=a.wait(p=>p.type==='LEFT');a.ws.send(JSON.stringify({type:'LEAVE'}));await left;
 const owner=await client(fixture.users[0],own.roomId);const chair=await owner.request('buy',{definitionId:'arcade-chair',requestId:randomUUID()});
 await assert.rejects(owner.request('place',{itemId:chair.item_id,x:0,y:0,rotation:0}));
 await owner.request('place',{itemId:chair.item_id,x:3,y:3,rotation:0,z:999});
 const snapshot=(await fixture.db.query('select public.world_room_snapshot($1,$2) result',[fixture.users[0],own.roomId])).rows[0].result;
 assert.equal(snapshot.items[0].z,0);assert.equal(snapshot.revision,1);
 const leaveOwner=owner.wait(p=>p.type==='LEFT');owner.ws.send(JSON.stringify({type:'LEAVE'}));await leaveOwner;
 for(const name of ['Hotel Lobby','Rooftop Lounge','Patio Hangout']){
  const entry=a.welcome.bootstrap.rooms.find(r=>r.name===name);assert.ok(entry);const visitor=await client(fixture.users[0],entry.id);
  const staff=visitor.events.find(p=>p.type==='NPC_SNAPSHOT').staff[0];assert.ok(staff.isStaff);assert.ok(visitor.welcome.scene.items.length>=12);
  assert.ok((await visitor.request('staff_talk',{staffId:staff.staffId})).greeting);
  await assert.rejects(visitor.request('staff_talk',{staffId:'staff-elsewhere'}));
  await assert.rejects(visitor.request('place',{itemId:visitor.welcome.scene.items[0].id,pickup:true}));
  await assert.rejects(visitor.request('place',{itemId:chair.item_id,x:2,y:2,rotation:0}));
  await assert.rejects(visitor.request('trade_create',{userId:staff.staffId}));
  assert.ok(!(await visitor.request('bootstrap')).items.some(i=>i.id===staff.staffId));
  const left=visitor.wait(p=>p.type==='LEFT');visitor.ws.send(JSON.stringify({type:'LEAVE'}));await left;
 }
 console.log('World network: authenticated two-client chat, private messaging, purchase, atomic trade, room switching, placement collision and server-owned height passed.');
}finally{for(const c of clients)c.ws.terminate();await gateway.close();await new Promise(r=>server.close(r));await fixture.close();}
