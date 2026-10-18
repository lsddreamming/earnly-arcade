import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
import {SupabaseWorldAccess} from '../world-server/src/supabase-access.ts';
import collections from '../world-collections.js';
const {db,users,close}=await worldFixture();
const api=async(actor,action,data={})=>(await db.query('select public.world_api($1,$2,$3::jsonb) result',[actor,action,JSON.stringify(data)])).rows[0].result;
try{
 const old=await api(users[0],'buy',{definitionId:'mint-sofa',requestId:crypto.randomUUID()});
 const balance=Number((await api(users[0],'bootstrap')).balance);
 const migration=await readFile('supabase/migrations/20261018001334_world_furniture_colors.sql','utf8');await db.exec(migration);await db.exec(migration);
 assert.equal(Number((await api(users[0],'bootstrap')).balance),balance);
 assert.equal((await db.query('select color from earnly_world.items where id=$1',[old.item_id])).rows[0].color,null);
 assert.deepEqual((await api(users[0],'bootstrap')).furnitureColors,collections.furnitureColors);
 const access=new SupabaseWorldAccess('https://world-test.invalid','server-only-test');
 const identity={userId:users[0],username:'Player0'},entered=await access.enter(identity,'home'),roomId=entered.roomId;
 let first;
 for(const {color} of collections.furnitureColors){
  const requestId=crypto.randomUUID(),data={definitionId:'arcade-chair',requestId,color};
  const receipt=await api(users[0],'buy',data);first??=receipt;assert.equal(receipt.color,color);
  assert.equal((await api(users[0],'buy',data)).item_id,receipt.item_id);
  await assert.rejects(api(users[0],'buy',{...data,color:null}));
  const placed=await access.perform(identity,roomId,'place',{itemId:receipt.item_id,x:2,y:2,rotation:4});
  assert.equal(placed.data.items.find(i=>i.id===receipt.item_id).color,color,'Live scene uses owned color');
  const reconnected=await new SupabaseWorldAccess('https://world-test.invalid','test').enter(identity,roomId);
  assert.equal(reconnected.scene.items.find(i=>i.id===receipt.item_id).color,color,'Reconnect preserves color');
  await access.perform(identity,roomId,'place',{itemId:receipt.item_id,pickup:true});
  assert.equal((await api(users[0],'bootstrap')).items.find(i=>i.id===receipt.item_id).color,color);
 }
 assert.equal(Number((await api(users[0],'bootstrap')).balance),balance-5*60);
 const beforeInvalid=await api(users[0],'bootstrap');
 for(const color of ['#ffffff','rose','url(evil)',{red:true}])await assert.rejects(api(users[0],'buy',{definitionId:'arcade-chair',requestId:crypto.randomUUID(),color}));
 assert.equal((await api(users[0],'bootstrap')).balance,beforeInvalid.balance);
 assert.equal((await api(users[0],'bootstrap')).items.length,beforeInvalid.items.length);
 await api(users[0],'accept_chat');await api(users[1],'accept_chat');
 const trade=(await db.query('insert into earnly_world.trades(player_a,player_b) values($1,$2) returning id',users)).rows[0].id;
 const step=(actor,revision,action,items=[])=>db.query('select public.world_trade_action($1,$2,$3,$4,$5::uuid[])',[actor,trade,revision,action,items]);
 await step(users[0],0,'edit',[first.item_id]);await step(users[0],1,'lock');await step(users[1],1,'lock');await step(users[0],1,'confirm');await step(users[1],1,'confirm');
 assert.equal((await api(users[1],'bootstrap')).items.find(i=>i.id===first.item_id).color,first.color,'Trading preserves selected color');
 // Replaying the original receipt after a trade cannot change the transferred color.
 await assert.rejects(api(users[0],'buy',{definitionId:'arcade-chair',requestId:first.request_id,color:collections.furnitureColors[1].color}));
 assert.equal((await api(users[1],'bootstrap')).items.find(i=>i.id===first.item_id).color,first.color);
 await db.exec('set role authenticated');await assert.rejects(api(users[0],'buy',{definitionId:'arcade-chair',requestId:crypto.randomUUID(),color:collections.furnitureColors[0].color}));
 console.log('PASS: five colors, exact charges, immutable retries, invalid input rollback, live placement/reconnect, pickup, trade, original preservation and client permission checks.');
}finally{await close();}
