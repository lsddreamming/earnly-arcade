import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
import prices from '../world-furniture-prices.js';
const {db,users,close}=await worldFixture();
const api=async(action,data={})=>(await db.query('select public.world_api($1,$2,$3::jsonb) r',[users[0],action,JSON.stringify(data)])).rows[0].r;
const apply=async name=>db.exec(await readFile('supabase/migrations/'+name+'.sql','utf8'));
try{
 await db.exec('create table public.arcade_pass_transactions(provider text,transaction_id text,user_id uuid,subscription_id text,expires_at timestamptz,revoked boolean);');
 for(const name of ['20261017022225_vip_furniture_gifts','20261017121618_world_social_collections','20261017235224_world_catalog_expansion','20261018000633_world_dream_beds','20261018152333_world_showcase_furniture','20261018001334_world_furniture_colors','20261018010214_world_themed_catalog_150','20261019192651_world_personal_pets','20261019222847_world_pet_beds','20261019232204_world_pet_toys','20261022192620_world_bathroom_collection','20261022195230_world_playroom_collection','20261022213254_world_seasonal_halloween'])await apply(name);
 await db.query('update public.coin_wallets set balance=500000 where user_id=$1',[users[0]]);
 const boardwalk=await readFile('supabase/migrations/20261016140648_neon_boardwalk_collection.sql','utf8');await db.exec(boardwalk.slice(boardwalk.indexOf('INSERT INTO earnly_world.item_definitions')));
 const economy=await readFile('supabase/migrations/20261021154706_balanced_arcade_economy.sql','utf8');
 await db.exec(economy.slice(economy.indexOf('INSERT INTO earnly_world.item_definitions')));
 const room=(await api('create_room',{name:'Pricing test'})).roomId;
 const oldRequest={definitionId:'bath-hamper',requestId:crypto.randomUUID(),expectedPrice:65};
 const old=await api('buy',oldRequest);await api('place',{roomId:room,itemId:old.item_id,x:2,y:2,z:0,rotation:2});
 const before=await api('bootstrap'),receipts=(await db.query('select * from earnly_world.purchase_receipts')).rows;
 const migration='20261023100920_world_furniture_price_rebalance';await apply(migration);
 const after=await api('bootstrap');assert.equal(after.balance,before.balance);assert.deepEqual(after.items,before.items);assert.deepEqual(after.rooms,before.rooms);
 assert.deepEqual((await db.query('select * from earnly_world.purchase_receipts')).rows,receipts);
 for(const d of after.catalog){const prev=before.catalog.find(p=>p.id===d.id);assert.deepEqual(d,{...prev,price:prices[d.id]??prev.price});if(Number(prev.price)>0)assert(Number(d.price)>Number(prev.price));else assert.equal(Number(d.price),0);}
 assert.equal(Object.keys(prices).length,after.catalog.filter(d=>Number(d.price)>0).length);
 await apply(migration);assert.deepEqual(await api('bootstrap'),after);
 assert.equal((await api('buy',oldRequest)).item_id,old.item_id,'old receipt replays without charging at new price');
 await assert.rejects(api('buy',{...oldRequest,requestId:crypto.randomUUID()}),/Price changed/);
 assert.equal((await api('bootstrap')).balance,after.balance);
 let spent=0,count=0;
 for(const d of after.catalog.filter(d=>Number(d.price)>0&&d.shop_available!==false)){
  const data={definitionId:d.id,requestId:crypto.randomUUID(),expectedPrice:prices[d.id]},bought=await api('buy',data);
  assert.equal(Number(bought.price),prices[d.id]);assert.equal((await api('buy',data)).item_id,bought.item_id);spent+=prices[d.id];count++;
 }
 assert.equal(Number((await api('bootstrap')).balance),Number(after.balance)-spent);
 await db.query('update public.coin_wallets set balance=199 where user_id=$1',[users[0]]);
 await assert.rejects(api('buy',{definitionId:'bath-hamper',requestId:crypto.randomUUID(),expectedPrice:200}),/Not enough/);
 await api('place',{itemId:old.item_id,roomId:room,pickup:true});await api('place',{itemId:old.item_id,roomId:room,x:3,y:3,z:0,rotation:6});
 assert.equal((await api('bootstrap')).items.find(i=>i.id===old.item_id).rotation,6);
 console.log(`PASS: ${Object.keys(prices).length} higher authoritative prices; ${count} exact purchases/replays; migration replay; stale quote and insufficient-funds protection; ownership/placement/VIP preservation.`);
}finally{await close();}
