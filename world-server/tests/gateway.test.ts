import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {attachWorldGateway} from '../src/gateway.ts';
import {RoomGrid,parseHeightmap} from '../src/grid.ts';
import {RoomRuntime} from '../src/room-runtime.ts';

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
