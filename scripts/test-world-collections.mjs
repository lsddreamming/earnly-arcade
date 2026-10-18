import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
import collections from '../world-collections.js';
const {db,users,close}=await worldFixture();
const api=async(action,data={})=>(await db.query('select public.world_api($1,$2,$3::jsonb) result',[users[0],action,JSON.stringify(data)])).rows[0].result;
try{
 const personal=await api('create_room',{name:'Keep my room'});
 const before=(await db.query('select id,owner_id,revision,public_items from earnly_world.rooms order by id')).rows;
 const wallet=(await api('bootstrap')).balance;
 const migration=await readFile('supabase/migrations/20261017121618_world_social_collections.sql','utf8');await db.exec(migration);
 const after=(await db.query('select id,owner_id,revision,public_items from earnly_world.rooms order by id')).rows;
 assert.equal((await api('bootstrap')).balance,wallet);
 for(const old of before){const next=after.find(r=>r.id===old.id);if(old.owner_id){assert.deepEqual(next,old);continue;}
  assert.equal(next.public_items.length,old.public_items.length);for(let i=0;i<old.public_items.length;i++)for(const key of ['id','x','y','z','width','length','rotation','walkable','canSit','canLay','canStack'])assert.deepEqual(next.public_items[i][key],old.public_items[i][key],key+' stays stable');
 }
 assert.equal(after.filter(r=>r.public_items.some(i=>collections.items.some(d=>d.id===i.definitionId))).length,3);
 await db.exec(migration);assert.deepEqual((await db.query('select id,owner_id,revision,public_items from earnly_world.rooms order by id')).rows,after,'Migration replay must not change rooms');
 const bootstrap=await api('bootstrap');assert.equal(bootstrap.catalog.length,47);
 let total=0;
 for(const item of collections.items){const d=bootstrap.catalog.find(d=>d.id===item.id);for(const key of ['sprite_id','width','length','can_sit','can_lay','can_stack','walkable','tradeable','category'])assert.equal(d[key],item[key],item.id+' '+key);assert.equal(Number(d.price),item.price);
  const requestId=crypto.randomUUID(),bought=await api('buy',{definitionId:item.id,requestId});assert.equal((await api('buy',{definitionId:item.id,requestId})).item_id,bought.item_id);total+=item.price;
  await assert.rejects(db.query("select public.world_api($1,'place',$2::jsonb)",[users[1],JSON.stringify({itemId:bought.item_id,roomId:personal.roomId,x:2,y:2,rotation:0})]));
 }
 assert.equal(Number((await api('bootstrap')).balance),Number(wallet)-total);
 assert.equal((await api('bootstrap')).items.filter(i=>collections.items.some(d=>d.id===i.definition_id)).length,12);
 const expandedMigration=await readFile('supabase/migrations/20261017235224_world_catalog_expansion.sql','utf8');
 const existing=(await db.query('select * from earnly_world.item_definitions order by id')).rows;
 const balanceBefore=(await api('bootstrap')).balance;
 await db.exec(expandedMigration);await db.exec(expandedMigration);
 const expanded=await api('bootstrap');assert.equal(expanded.catalog.length,71);
 assert.equal(expanded.balance,balanceBefore,'Catalog expansion never changes wallets');
 for(const old of existing)assert.deepEqual((await db.query('select * from earnly_world.item_definitions where id=$1',[old.id])).rows[0],old);
 // Test-only funds cover buying every new piece; no production wallet is touched.
 await db.query('update public.coin_wallets set balance=10000 where user_id=$1',[users[0]]);
 let expansionTotal=0;
 for(const item of collections.expansionItems){
  const d=expanded.catalog.find(d=>d.id===item.id);for(const key of ['sprite_id','width','length','can_sit','can_lay','can_stack','walkable','tradeable','category'])assert.equal(d[key],item[key],item.id+' '+key);assert.equal(Number(d.price),item.price);
  const requestId=crypto.randomUUID(),bought=await api('buy',{definitionId:item.id,requestId});assert.equal((await api('buy',{definitionId:item.id,requestId})).item_id,bought.item_id);expansionTotal+=item.price;
  await api('place',{itemId:bought.item_id,roomId:personal.roomId,x:1,y:1,z:0,rotation:0});
  await assert.rejects(db.query("select public.world_api($1,'place',$2::jsonb)",[users[1],JSON.stringify({itemId:bought.item_id,roomId:personal.roomId,x:2,y:2,rotation:0})]));
  await api('place',{itemId:bought.item_id,roomId:personal.roomId,pickup:true});
 }
 assert.equal(Number((await api('bootstrap')).balance),10000-expansionTotal);
 const bedMigration=await readFile('supabase/migrations/20261018000633_world_dream_beds.sql','utf8');
 const beforeBeds=(await db.query('select * from earnly_world.item_definitions order by id')).rows;
 const beforeBedBalance=Number((await api('bootstrap')).balance);
 await db.exec(bedMigration);await db.exec(bedMigration);
 const beds=await api('bootstrap');assert.equal(beds.catalog.length,79);assert.equal(Number(beds.balance),beforeBedBalance);
 for(const old of beforeBeds)assert.deepEqual((await db.query('select * from earnly_world.item_definitions where id=$1',[old.id])).rows[0],old);
 let bedTotal=0;
 for(const item of collections.bedItems){
  const d=beds.catalog.find(d=>d.id===item.id);for(const key of ['sprite_id','width','length','can_lay','can_sit','walkable','category'])assert.equal(d[key],item[key],item.id+' '+key);assert.equal(Number(d.price),item.price);
  const requestId=crypto.randomUUID(),bought=await api('buy',{definitionId:item.id,requestId});assert.equal((await api('buy',{definitionId:item.id,requestId})).item_id,bought.item_id);bedTotal+=item.price;
  for(const rotation of [0,2,4,6])await api('place',{itemId:bought.item_id,roomId:personal.roomId,x:1,y:1,z:0,rotation});
  await api('place',{itemId:bought.item_id,roomId:personal.roomId,pickup:true});
 }
 assert.equal(Number((await api('bootstrap')).balance),beforeBedBalance-bedTotal);
 const themedMigration=await readFile('supabase/migrations/20261018010214_world_themed_catalog_150.sql','utf8');
 const beforeThemes=(await db.query('select * from earnly_world.item_definitions order by id')).rows;
 const beforeThemeBalance=(await api('bootstrap')).balance;
 await db.exec(themedMigration);await db.exec(themedMigration);
 const themed=await api('bootstrap');assert.equal(themed.catalog.length,143);assert.equal(themed.balance,beforeThemeBalance);
 for(const old of beforeThemes)assert.deepEqual((await db.query('select * from earnly_world.item_definitions where id=$1',[old.id])).rows[0],old);
 await db.query('update public.coin_wallets set balance=30000 where user_id=$1',[users[0]]);
 let themedTotal=0;
 for(const item of collections.themedItems){
  const d=themed.catalog.find(d=>d.id===item.id);
  for(const key of ['sprite_id','width','length','can_sit','can_lay','can_stack','walkable','tradeable','category'])assert.equal(d[key],item[key],item.id+' '+key);
  assert.equal(Number(d.price),item.price);
  const requestId=crypto.randomUUID(),bought=await api('buy',{definitionId:item.id,requestId});
  assert.equal((await api('buy',{definitionId:item.id,requestId})).item_id,bought.item_id);themedTotal+=item.price;
  for(const rotation of [0,2,4,6])await api('place',{itemId:bought.item_id,roomId:personal.roomId,x:1,y:1,z:0,rotation});
  await api('place',{itemId:bought.item_id,roomId:personal.roomId,pickup:true});
 }
 assert.equal(Number((await api('bootstrap')).balance),30000-themedTotal);
 const beforeShowcase=(await db.query('select * from earnly_world.item_definitions order by id')).rows;
 const beforeShowcaseBalance=Number((await api('bootstrap')).balance);
 const showcaseMigration=await readFile('supabase/migrations/20261018152333_world_showcase_furniture.sql','utf8');
 await db.exec(showcaseMigration);await db.exec(showcaseMigration);
 const showcase=await api('bootstrap');assert.equal(showcase.catalog.length,151);assert.equal(Number(showcase.balance),beforeShowcaseBalance);
 for(const old of beforeShowcase)assert.deepEqual((await db.query('select * from earnly_world.item_definitions where id=$1',[old.id])).rows[0],old);
 let showcaseTotal=0;
 for(const item of collections.showcaseItems){
  const d=showcase.catalog.find(d=>d.id===item.id);
  for(const key of ['sprite_id','width','length','can_sit','can_lay','can_stack','walkable','tradeable','category'])assert.equal(d[key],item[key],item.id+' '+key);
  assert.equal(Number(d.price),item.price);
  const requestId=crypto.randomUUID(),bought=await api('buy',{definitionId:item.id,requestId});
  assert.equal((await api('buy',{definitionId:item.id,requestId})).item_id,bought.item_id);showcaseTotal+=item.price;
  for(const rotation of [0,2,4,6])await api('place',{itemId:bought.item_id,roomId:personal.roomId,x:1,y:1,z:0,rotation});
  await api('place',{itemId:bought.item_id,roomId:personal.roomId,pickup:true});
 }
 assert.equal(Number((await api('bootstrap')).balance),beforeShowcaseBalance-showcaseTotal);
 console.log('PASS: eight showcase pieces, exact purchases, duplicate protection, four rotations, pickup and preservation.');
 console.log('PASS: 64 themed designs, metadata parity, four rotations, exact charges and replay-safe preservation.');
 console.log('PASS: eight distinct beds, all four placement directions, exact charges, replay-safe migration, preserved existing definitions and wallets.');
 console.log('PASS: 24 expanded pieces, exact charges, duplicate protection, placement/pickup, owner permissions, migration replay and existing catalog preservation.');
 console.log('PASS: 12 original pieces, catalog parity, exact single charges, duplicate protection, owner permissions, 3 public room refreshes, stable footprints and untouched private rooms.');
}finally{await close();}
