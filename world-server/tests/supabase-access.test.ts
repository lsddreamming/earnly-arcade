import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseWorldAccess} from '../src/supabase-access.ts';
import {WorldAccessError} from '../src/access-error.ts';

test('a rejected server API key is distinguished from a player session failure',async t=>{
  for(const response of [
    new Response('{}',{status:401,headers:{'sb-error-code':'UNAUTHORIZED_INVALID_API_KEY'}}),
    Response.json({message:'Invalid API key'},{status:401})
  ]){
    t.mock.method(globalThis,'fetch',async()=>response);
    await assert.rejects(new SupabaseWorldAccess('https://world-test.invalid','server-key').authenticate('player-token'),
      error=>error instanceof WorldAccessError&&error.reason==='server_configuration'&&!error.message.includes('server-key'));
    t.mock.restoreAll();
  }
});

test('an expired player session still fails closed with a sign-in classification',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({message:'JWT expired'},{status:401}));
  await assert.rejects(new SupabaseWorldAccess('https://world-test.invalid','server-key').authenticate('expired-token'),
    error=>error instanceof WorldAccessError&&error.reason==='sign_in_required');
});

test('confirmed account is still required after successful token verification',async t=>{
  for(const user of [{id:'user',is_anonymous:true,email_confirmed_at:'2026-01-01'},{id:'user'},{}]){
    t.mock.method(globalThis,'fetch',async()=>Response.json(user));
    await assert.rejects(new SupabaseWorldAccess('https://world-test.invalid','server-key').authenticate('player-token'),
      error=>error instanceof WorldAccessError&&error.reason==='confirmed_account_required');
    t.mock.restoreAll();
  }
});

test('copied surrounding whitespace is removed from the server key without changing the player token',async t=>{
  t.mock.method(globalThis,'fetch',async(url:unknown,options:any)=>{
    assert.equal(url,'https://world-test.invalid/auth/v1/user');
    assert.equal(options.headers.apikey,'server-key');
    assert.equal(options.headers.Authorization,'Bearer player-token');
    return Response.json({id:'user',email_confirmed_at:'2026-01-01'});
  });
  assert.deepEqual(await new SupabaseWorldAccess('https://world-test.invalid',' \nserver-key\n ').authenticate('player-token'),{userId:'user',username:'user'});
});

test('room directories count connected humans, refresh after leave, and use the authenticated actor',async t=>{
 const friend='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222';
 const rooms=[{id:'home',name:'Home',ownerId:actor},{id:'garden',name:'Garden',ownerId:friend},{id:'empty',name:'Empty',ownerId:friend}];
 let denied=false;
 t.mock.method(globalThis,'fetch',async(url:unknown,options:any)=>{
  const body=JSON.parse(options.body);
  if(String(url).endsWith('world_explore_rooms'))assert.fail('Retired Explore must not enumerate personal rooms');
  if(String(url).endsWith('world_search_rooms')){assert.equal(body.p_actor,actor);assert.equal(body.p_query,'Buddy');assert.equal(body.p_offset,12);return Response.json({rooms:rooms.slice(1),nextOffset:24});}
  if(String(url).endsWith('world_friend_rooms')){assert.equal(body.p_actor,actor);assert.equal(body.p_friend,friend);return denied?Response.json({message:'Player unavailable',code:'P0001'},{status:400}):Response.json(rooms.slice(1));}
  if(String(url).endsWith('world_api'))return Response.json({rooms,catalog:[],items:[],friends:[]});
  return Response.json({roomId:body.p_room,username:'Player',name:'Room',ownerId:actor,access:'open',heightmap:'0000\n0000\n0000\n0000',revision:0,capacity:25,items:[],equipped:{}});
 });
 const access=new SupabaseWorldAccess('https://world-test.invalid','server-key'),identity={userId:actor,username:'Me'};
 const home=await access.enter(identity,'home');assert.equal(home.scene.chatRange,'room');assert.equal(home.room.roomWideChat,true);home.room.join(identity,home.spawn,()=>{});
 const garden=await access.enter({userId:friend,username:'Friend'},'garden');garden.room.join({userId:friend,username:'Friend'},garden.spawn,()=>{});
 const get=async()=> (await access.perform(identity,home.roomId,'friend_rooms',{userId:friend,p_actor:friend})).data;
 assert.deepEqual((await get()).map((r:any)=>r.occupancy),[1,0]);
 garden.room.leave(friend);assert.deepEqual((await get()).map((r:any)=>r.occupancy),[0,0]);
 const directory=await access.perform(identity,home.roomId,'room_directory',{});assert.equal(directory.data[0].occupancy,1);
 const explored=await access.perform(identity,home.roomId,'room_explore',{query:' Buddy ',offset:12,p_actor:friend});assert.deepEqual(explored.data,{rooms:[],nextOffset:null});
 const searched=await access.perform(identity,home.roomId,'room_search',{query:' Buddy ',offset:12,p_actor:friend});assert.equal(searched.data.rooms.length,2);assert.equal(searched.data.nextOffset,24);
 for(const data of [{query:''},{query:'a'},{query:'a'.repeat(81)},{query:'Buddy',offset:-1},{query:'Buddy',offset:1.5},{query:'Buddy',offset:'12'},{query:'Buddy',offset:1201}])await assert.rejects(access.perform(identity,home.roomId,'room_search',data));
 denied=true;await assert.rejects(get,/Player unavailable/);
 await assert.rejects(access.perform(identity,home.roomId,'friend_rooms',{userId:'invalid'}),/Player unavailable/);
});

test('entry telemetry and public-visit evidence use the server-only RPCs and trusted identity',async t=>{
 const calls:{url:string;body:any;authorization:string}[]=[];
 t.mock.method(globalThis,'fetch',async(url:unknown,options:any)=>{calls.push({url:String(url),body:JSON.parse(options.body),authorization:options.headers.Authorization});return Response.json(true);});
 await new SupabaseWorldAccess('https://world-test.invalid','server-key').recordEntry({userId:'actor',username:'Player'},'room',2);
 assert.equal(calls.length,3);
 for(const call of calls){assert.equal(call.authorization,'Bearer server-key');assert.equal(call.body.p_actor,'actor');assert.equal(call.body.p_room,'room');}
 assert.equal(calls[0].url,'https://world-test.invalid/rest/v1/rpc/activity_record');assert.equal(calls[0].body.p_kind,'world_join');assert.equal(calls[0].body.p_occupancy,2);
 assert.equal(calls[1].url,'https://world-test.invalid/rest/v1/rpc/world_daily_visit');
 assert.equal(calls[2].body.p_step,'join');
});

test('social actions bind actor and room on the server and notify only the invited friend once',async t=>{
 const actor='22222222-2222-4222-8222-222222222222',friend='11111111-1111-4111-8111-111111111111';let duplicate=false;const calls:any[]=[];
 t.mock.method(globalThis,'fetch',async(url:unknown,options:any)=>{
  const p=JSON.parse(options.body);
  if(String(url).endsWith('world_api'))return Response.json({rooms:[],catalog:[],items:[],friends:[]});
  if(String(url).endsWith('world_social')){calls.push(p);return Response.json(p.p_action==='invite'?{recipient:friend,duplicate}:[]);}
  return Response.json({roomId:p.p_room,username:'Player',name:'Room',ownerId:actor,access:'open',heightmap:'0000\n0000\n0000\n0000',revision:0,capacity:25,items:[],equipped:{}});
 });
 const access=new SupabaseWorldAccess('https://world-test.invalid','key'),identity={userId:actor,username:'Me'};await access.enter(identity,'current-room');
 const first=await access.perform(identity,'current-room','invite',{userId:friend,roomId:'forged-room',p_actor:friend});
 assert.deepEqual(calls[0],{p_actor:actor,p_room:'current-room',p_action:'invite',p_data:{userId:friend}});
 assert.deepEqual(first.deliveries,[{userIds:[friend],packet:{type:'ROOM_INVITE'}}]);
 duplicate=true;assert.deepEqual((await access.perform(identity,'current-room','invite',{userId:friend})).deliveries,[]);
 await access.perform(identity,'current-room','weekly_enter',{amount:999,userId:friend});assert.deepEqual(calls.at(-1).p_data,{});
 await assert.rejects(access.perform(identity,'current-room','react',{reaction:'bad'}),/Invalid reaction/);
 await assert.rejects(access.perform(identity,'current-room','invite',{userId:'bad'}),/Player unavailable/);
});

test('public room cards count materialized residents before the first human visit, without inventing player occupancy',async t=>{
 const actor='22222222-2222-4222-8222-222222222222',rooms=[{id:'home',name:'Home',ownerId:actor},{id:'lobby',name:'Hotel Lobby',ownerId:null},{id:'roof',name:'Rooftop Lounge',ownerId:null},{id:'tiny',name:'Tiny',ownerId:null}];
 const loaded:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:unknown,options:any)=>{
  const body=JSON.parse(options.body);assert.equal(body.p_actor,actor);
  if(String(url).endsWith('world_api'))return Response.json({rooms,catalog:[],items:[],friends:[]});
  if(String(url).endsWith('world_residents'))return Response.json({quiet:false,remember:false,relations:[]});
  loaded.push(body.p_room);return Response.json({roomId:body.p_room,username:'Player',name:rooms.find(r=>r.id===body.p_room)?.name,ownerId:body.p_room==='home'?actor:null,access:'open',heightmap:body.p_room==='tiny'?'00\n00':Array(12).fill('000000000000').join('\n'),revision:0,capacity:25,items:[],equipped:{}});
 });
 const access=new SupabaseWorldAccess('https://world-test.invalid','server-key'),identity={userId:actor,username:'Me'};
 const home=await access.enter(identity,'home');assert.equal(home.scene.chatRange,'room');assert.equal(home.room.roomWideChat,true);home.room.join(identity,home.spawn,()=>{});
 const directory=async()=>(await access.perform(identity,'home','room_directory',{})).data;
 const results=await Promise.all([directory(),directory()]);
 for(const result of results){for(const id of ['lobby','roof']){const card=result.find((r:any)=>r.id===id);assert.equal(card.occupancy,0);assert.ok(card.residentCount>=4&&card.residentCount<=5);assert.equal(card.spudCount,card.residentCount);}assert.equal(result.find((r:any)=>r.id==='tiny').spudCount,0);}
 assert.equal(loaded.filter(id=>id==='lobby').length,1,'concurrent directory refreshes share one warmup');
 const before=results[0].find((r:any)=>r.id==='lobby');
 const lobby=await access.enter(identity,'lobby');assert.equal(lobby.scene.chatRange,'nearby');assert.equal(lobby.room.roomWideChat,false);assert.equal(lobby.room.memberCount,0);assert.equal(lobby.room.spuds.snapshots().length,before.residentCount);
 for(let i=0;i<500;i++)lobby.room.spuds.tick(lobby.room.grid,new Set(),25,true);assert.equal(lobby.room.spuds.snapshots().length,0);
 assert.equal((await directory()).find((r:any)=>r.id==='lobby').residentCount,before.residentCount,'an idle room repopulates after a real crowd has left');
 lobby.room.join(identity,lobby.room.availableSpawn(),()=>{});
 const joined=(await directory()).find((r:any)=>r.id==='lobby');assert.equal(joined.occupancy,1);assert.equal(joined.spudCount,before.spudCount+1);
 lobby.room.leave(actor);assert.equal((await directory()).find((r:any)=>r.id==='lobby').occupancy,0);
});

test('failed public room warmups do not invent occupants or initialize private player rooms',async t=>{
 const rooms=[{id:'home',name:'Home',ownerId:'actor'},{id:'unavailable',name:'Unavailable',ownerId:null},{id:'other-home',name:'Other Home',ownerId:'other'}],loaded:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:unknown,options:any)=>{
  const body=JSON.parse(options.body);if(String(url).endsWith('world_api'))return Response.json({rooms,catalog:[],items:[],friends:[]});
  if(String(url).endsWith('world_residents'))return Response.json({quiet:false,remember:false,relations:[]});
  loaded.push(body.p_room);if(body.p_room==='unavailable')return Response.json({message:'Unavailable'},{status:400});
  return Response.json({roomId:'home',username:'Player',name:'Home',ownerId:'actor',access:'open',heightmap:'0000\n0000\n0000\n0000',revision:0,capacity:25,items:[],equipped:{}});
 });
 const access=new SupabaseWorldAccess('https://world-test.invalid','server-key'),identity={userId:'actor',username:'Me'},home=await access.enter(identity,'home');home.room.join(identity,home.spawn,()=>{});
 const result=(await access.perform(identity,'home','room_directory',{})).data;assert.equal(result.find((r:any)=>r.id==='unavailable').spudCount,0);assert.equal(loaded.includes('other-home'),false);
});

test('only accepted, nonduplicate normal chat can trigger a public resident reply',async t=>{
 let duplicate=false,denied=false;const calls:any[]=[];
 t.mock.method(globalThis,'fetch',async(url:unknown,options:any)=>{
  const p=JSON.parse(options.body);
  if(String(url).endsWith('world_api')){
   if(p.p_action==='say'){calls.push(p);if(denied)return Response.json({message:'Chat rules required'},{status:400});return Response.json({text:'hello',mode:p.p_data.mode,viewers:['actor'],duplicate});}
   return Response.json({rooms:[],catalog:[],items:[],friends:[]});
  }
  return Response.json({roomId:p.p_room,username:'Player',name:'Room',ownerId:'actor',access:'open',heightmap:'0000\n0000\n0000\n0000',revision:0,capacity:25,items:[],equipped:{}});
 });
 const access=new SupabaseWorldAccess('https://world-test.invalid','key'),identity={userId:'actor',username:'Me'},entry=await access.enter(identity,'current');entry.room.join(identity,entry.spawn,()=>{});
 const replies:any[]=[];t.mock.method(entry.room,'queueResidentReply',(...args:any[])=>{replies.push(args);return true;});
 await access.perform(identity,'current','say',{text:'hello',mode:'normal',requestId:'one',residentId:'jax',viewers:['forged'],userId:'forged'});assert.deepEqual(replies,[['actor','hello',['actor'],'jax']]);assert.deepEqual(calls[0].p_data.viewers,['actor']);
 duplicate=true;await access.perform(identity,'current','say',{text:'hello',mode:'normal',requestId:'one'});duplicate=false;
 await access.perform(identity,'current','say',{text:'hello',mode:'whisper',userId:'actor',requestId:'two'});
 await access.perform(identity,'current','say',{text:'hello',mode:'shout',requestId:'three'});
 denied=true;await assert.rejects(access.perform(identity,'current','say',{text:'hello',mode:'normal',requestId:'four'}),/Action unavailable/);assert.equal(replies.length,1);
});
