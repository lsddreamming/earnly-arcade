import {test} from 'node:test';
import {WorldAccessError} from '../src/access-error.ts';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {attachWorldGateway} from '../src/gateway.ts';
import {RoomGrid,parseHeightmap} from '../src/grid.ts';
import {RoomRuntime} from '../src/room-runtime.ts';
import {setTimeout as delay} from 'node:timers/promises';

test('real WebSocket connections require auth; joined users share server tick updates',async()=>{
 const server=createServer();const room=new RoomRuntime(new RoomGrid(parseHeightmap('000\n000')));
 const gateway=attachWorldGateway(server,{
   authenticate:async token=>{if(!['a','b'].includes(token))throw new Error();return {userId:token,username:token};},
   enter:async identity=>({room,spawn:{x:identity.userId==='a'?0:2,y:0}}),
   revalidate:async()=>true
 },new Set(['https://earnlyarcade.com']));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=(server.address() as {port:number}).port;
 const sockets:WebSocket[]=[];
 const connect=async()=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/world`,{origin:'https://earnlyarcade.com'});sockets.push(ws);await once(ws,'open');return ws;};
 const message=(ws:WebSocket,type:string)=>new Promise<Record<string,unknown>>((resolve,reject)=>{
   const timer=setTimeout(()=>{ws.off('message',listener);reject(new Error('Message timeout'));},2000);
   const listener=(data:Buffer)=>{const p=JSON.parse(data.toString());if(p.type===type){clearTimeout(timer);ws.off('message',listener);resolve(p);}};
   ws.on('message',listener);
 });
 try{
   const denied=await connect();const closed=once(denied,'close');
   denied.send(JSON.stringify({type:'JOIN',version:1,token:'invalid',roomId:'plaza'}));
   assert.equal((await closed)[0],1008);
   const a=await connect();let ready=message(a,'ROOM_SNAPSHOT');
   a.send(JSON.stringify({type:'JOIN',version:1,token:'a',roomId:'plaza'}));await ready;
   const b=await connect();ready=message(b,'ROOM_SNAPSHOT');
   b.send(JSON.stringify({type:'JOIN',version:1,token:'b',roomId:'plaza'}));await ready;
   const delta=message(b,'ROOM_DELTA');a.send(JSON.stringify({type:'MOVE_TO',x:1,y:0}));
   const result=await delta;assert.equal((result.users as {userId:string}[])[0].userId,'a');
   const duplicate=await connect();const duplicateClosed=once(duplicate,'close');
   duplicate.send(JSON.stringify({type:'JOIN',version:1,token:'a',roomId:'plaza'}));
   assert.equal((await duplicateClosed)[0],1008);
 }finally{for(const ws of sockets)ws.terminate();await gateway.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('room admission has a separate budget from receiving JOIN',async()=>{
 const server=createServer();const room=new RoomRuntime(new RoomGrid(parseHeightmap('000\n000')));
 const events:unknown[]=[];
 const gateway=attachWorldGateway(server,{
  authenticate:async()=>{await delay(150);return {userId:'slow',username:'Slow'};},
  enter:async()=>{await delay(150);return {room,spawn:{x:0,y:0},scene:{name:'Test'},bootstrap:{}};},
  revalidate:async()=>true
 },new Set(['https://earnlyarcade.com']),{joinTimeoutMs:100,admissionTimeoutMs:1000,diagnostic:event=>events.push(event)});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const ws=new WebSocket(`ws://127.0.0.1:${(server.address() as {port:number}).port}/world`,{origin:'https://earnlyarcade.com'});
 try{
  await once(ws,'open');
  const welcome=new Promise<any>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('No welcome')),1500);
   ws.on('message',data=>{const packet=JSON.parse(data.toString());if(packet.type==='WELCOME'){clearTimeout(timer);resolve(packet);}});
  });
  ws.send(JSON.stringify({type:'JOIN',version:1,token:'private-token',roomId:'plaza'}));
  assert.equal((await welcome).userId,'slow');assert.equal(room.memberCount,1);
  assert.deepEqual(events,[{event:'world_entry_ready',stage:'admitted'}]);
 }finally{ws.terminate();await gateway.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('stalled authentication closes with a retryable code and never admits a late result',async()=>{
 const server=createServer();const events:unknown[]=[];let entered=false;
 const gateway=attachWorldGateway(server,{
  authenticate:async()=>{await delay(250);return {userId:'late',username:'Late'};},
  enter:async()=>{entered=true;throw new Error('must not enter');},revalidate:async()=>true
 },new Set(['https://earnlyarcade.com']),{joinTimeoutMs:500,admissionTimeoutMs:100,diagnostic:event=>events.push(event)});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const ws=new WebSocket(`ws://127.0.0.1:${(server.address() as {port:number}).port}/world`,{origin:'https://earnlyarcade.com'});
 try{
  await once(ws,'open');const closed=once(ws,'close');
  ws.send(JSON.stringify({type:'JOIN',version:1,token:'private-token',roomId:'plaza'}));
  assert.equal((await closed)[0],1013);await delay(200);assert.equal(entered,false);
  assert.deepEqual(events,[{event:'world_entry_timeout',stage:'authentication'}]);
 }finally{ws.terminate();await gateway.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});


test('configuration failures never blame the player or admit them, and diagnostics contain fixed labels only',async()=>{
 const server=createServer();const events:unknown[]=[];let entered=false;
 const gateway=attachWorldGateway(server,{
  authenticate:async()=>{throw new WorldAccessError('server_configuration');},
  enter:async()=>{entered=true;throw new Error('must not enter');},revalidate:async()=>false
 },new Set(['https://earnlyarcade.com']),{diagnostic:event=>events.push(event)});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const ws=new WebSocket(`ws://127.0.0.1:${(server.address() as {port:number}).port}/world`,{origin:'https://earnlyarcade.com'});
 try{
  await once(ws,'open');const closed=once(ws,'close');
  ws.send(JSON.stringify({type:'JOIN',version:1,token:'private-player-token',roomId:'plaza'}));
  const [code,reason]=await closed;assert.equal(code,1011);assert.equal(reason.toString(),'World service configuration');assert.equal(entered,false);
  assert.deepEqual(events,[{event:'world_entry_denied',stage:'authentication',reason:'server_configuration'}]);
 }finally{ws.terminate();await gateway.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
