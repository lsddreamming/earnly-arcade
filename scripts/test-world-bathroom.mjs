import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
import collections from '../world-collections.js';
const {db,users,close}=await worldFixture();
const api=async(action,data={})=>(await db.query('select public.world_api($1,$2,$3::jsonb) result',[users[0],action,JSON.stringify(data)])).rows[0].result;
try{
 const room=(await api('create_room',{name:'Bathroom test'})).roomId;
 const before=(await db.query('select * from earnly_world.item_definitions order by id')).rows;
 const rooms=(await db.query('select * from earnly_world.rooms order by id')).rows;
 const balance=Number((await api('bootstrap')).balance);
 const migration=await readFile('supabase/migrations/20261022192620_world_bathroom_collection.sql','utf8');
 await db.exec(migration);await db.exec(migration);
 assert.deepEqual((await db.query('select * from earnly_world.rooms order by id')).rows,rooms);
 for(const old of before)assert.deepEqual((await db.query('select * from earnly_world.item_definitions where id=$1',[old.id])).rows[0],old);
 assert.equal(Number((await api('bootstrap')).balance),balance);
 let spent=0;
 for(const item of collections.bathroomItems){
  const d=(await api('bootstrap')).catalog.find(d=>d.id===item.id);
  for(const key of ['name','sprite_id','width','length','category','walkable','can_stack','can_sit','can_lay'])assert.equal(d[key],item[key],item.id+' '+key);
  assert.equal(Number(d.price),item.price);assert.equal(Number(d.item_height),item.item_height);
  const requestId=crypto.randomUUID(),bought=await api('buy',{definitionId:item.id,requestId});
  assert.equal((await api('buy',{definitionId:item.id,requestId})).item_id,bought.item_id);spent+=item.price;
  for(const rotation of [0,2,4,6]){
   await api('place',{itemId:bought.item_id,roomId:room,x:2,y:2,z:0,rotation});
   const snapshot=(await db.query('select public.world_room_snapshot($1,$2) r',[users[0],room])).rows[0].r;
   const saved=snapshot.items.find(i=>i.id===bought.item_id);assert.equal(saved.rotation,rotation);assert.equal(saved.sprite,item.sprite_id);
  }
  await assert.rejects(db.query("select public.world_api($1,'place',$2::jsonb)",[users[1],JSON.stringify({itemId:bought.item_id,roomId:room,x:3,y:3,rotation:0})]));
  await api('place',{itemId:bought.item_id,roomId:room,pickup:true});
 }
 assert.equal(Number((await api('bootstrap')).balance),balance-spent);
 console.log('PASS: 9 bathroom pieces; replay-safe migration; unchanged rooms/wallets; exact purchases; duplicate protection; 36 saved rotations; owner-only placement and pickup.');
}finally{await close();}
