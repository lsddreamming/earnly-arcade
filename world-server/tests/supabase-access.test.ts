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
  if(String(url).endsWith('world_friend_rooms')){assert.equal(body.p_actor,actor);assert.equal(body.p_friend,friend);return denied?Response.json({message:'Player unavailable',code:'P0001'},{status:400}):Response.json(rooms.slice(1));}
  if(String(url).endsWith('world_api'))return Response.json({rooms,catalog:[],items:[],friends:[]});
  return Response.json({roomId:body.p_room,username:'Player',name:'Room',ownerId:actor,access:'open',heightmap:'0000\n0000\n0000\n0000',revision:0,capacity:25,items:[],equipped:{}});
 });
 const access=new SupabaseWorldAccess('https://world-test.invalid','server-key'),identity={userId:actor,username:'Me'};
 const home=await access.enter(identity,'home');home.room.join(identity,home.spawn,()=>{});
 const garden=await access.enter({userId:friend,username:'Friend'},'garden');garden.room.join({userId:friend,username:'Friend'},garden.spawn,()=>{});
 const get=async()=> (await access.perform(identity,home.roomId,'friend_rooms',{userId:friend,p_actor:friend})).data;
 assert.deepEqual((await get()).map((r:any)=>r.occupancy),[1,0]);
 garden.room.leave(friend);assert.deepEqual((await get()).map((r:any)=>r.occupancy),[0,0]);
 const directory=await access.perform(identity,home.roomId,'room_directory',{});assert.equal(directory.data[0].occupancy,1);
 denied=true;await assert.rejects(get,/Player unavailable/);
 await assert.rejects(access.perform(identity,home.roomId,'friend_rooms',{userId:'invalid'}),/Player unavailable/);
});

test('entry telemetry uses the server-only RPC and trusted identity',async t=>{
 t.mock.method(globalThis,'fetch',async(url:unknown,options:any)=>{
  assert.equal(url,'https://world-test.invalid/rest/v1/rpc/activity_record');
  assert.equal(options.headers.Authorization,'Bearer server-key');
  const body=JSON.parse(options.body);assert.equal(body.p_actor,'actor');assert.equal(body.p_room,'room');assert.equal(body.p_kind,'world_join');assert.equal(body.p_occupancy,2);assert.match(body.p_id,/^[0-9a-f-]{36}$/);return Response.json(true);
 });
 await new SupabaseWorldAccess('https://world-test.invalid','server-key').recordEntry({userId:'actor',username:'Player'},'room',2);
});
