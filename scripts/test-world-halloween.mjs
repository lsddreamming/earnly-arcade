import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
import collections from '../world-collections.js';
const {db,users,close}=await worldFixture();
const api=async(action,data={})=>(await db.query('select public.world_api($1,$2,$3::jsonb) result',[users[0],action,JSON.stringify(data)])).rows[0].result;
const apply=async name=>db.exec(await readFile('supabase/migrations/'+name+'.sql','utf8'));
const {halloweenItems,householdItems,isShopAvailable}=collections;
try{
 // Exercise the real VIP/color patches and personal-pet wrapper, not an obsolete API.
 await db.exec('create table public.arcade_pass_transactions(provider text,transaction_id text,user_id uuid,subscription_id text,expires_at timestamptz,revoked boolean);');
 for(const name of ['20261017022225_vip_furniture_gifts','20261018001334_world_furniture_colors','20261018010214_world_themed_catalog_150','20261019192651_world_personal_pets','20261022192620_world_bathroom_collection','20261022195230_world_playroom_collection'])await apply(name);
 const room=(await api('create_room',{name:'Season test'})).roomId;
 const old=(await api('buy',{definitionId:'cauldron',requestId:crypto.randomUUID()})).item_id;
 const before=await api('bootstrap');
 const migration='20261022213254_world_seasonal_halloween';await apply(migration);await apply(migration);
 const after=await api('bootstrap');assert.deepEqual(after.items,before.items);assert.deepEqual(after.rooms,before.rooms);assert.equal(after.balance,before.balance);assert.equal(after.petsEnabled,true);assert.deepEqual(after.furnitureColors,collections.furnitureColors);
 for(const d of before.catalog){const updated=after.catalog.find(i=>i.id===d.id);assert.deepEqual(updated,{...d,season:null,shop_available:true});}
 for(const item of [...halloweenItems,...householdItems]){const d=after.catalog.find(d=>d.id===item.id);for(const key of Object.keys(item))assert.equal(d[key],item[key],item.id+' '+key);}
 let boundaryCount=0;
 for(const year of [2026,2027,2028,2032])for(const [suffix,expected]of [['01-01T00:00:00Z',false],['09-30T23:59:59.999Z',false],['10-01T00:00:00Z',true],['11-02T23:59:59.999Z',true],['11-03T00:00:00Z',false],['12-31T23:59:59Z',false],['09-30T19:00:00-05:00',true],['11-02T19:00:00-05:00',false]]){
  const at=year+'-'+suffix;const result=(await db.query("select earnly_world.season_available('halloween',$1::timestamptz) ok",[at])).rows[0].ok;
  assert.equal(result,expected,at);assert.equal(isShopAvailable(halloweenItems[0],new Date(at)),expected,at);boundaryCount++;
 }
 assert.equal(isShopAvailable({...halloweenItems[0],shop_available:false},new Date('2026-10-22Z')),false);
 assert.equal(isShopAvailable({season:'unknown'}),false);
 // Test-only clock injection: production helper defaults to database now(), never client data.
 await db.exec("alter function earnly_world.season_available(text,timestamptz) rename to season_available_at; create table earnly_world.test_clock(at timestamptz); insert into earnly_world.test_clock values('2026-10-01T00:00:00Z'); create function earnly_world.season_available(p_season text,p_at timestamptz default now()) returns boolean language sql stable security invoker set search_path='' as 'select earnly_world.season_available_at(p_season,(select at from earnly_world.test_clock))';");
 const clock=at=>db.query('update earnly_world.test_clock set at=$1',[at]);
 const bought=[];let spent=0;
 for(const item of halloweenItems){
  const data={definitionId:item.id,requestId:crypto.randomUUID(),color:collections.furnitureColors[0].color};
  const receipt=await api('buy',data);bought.push({item,receipt,data});spent+=item.price;
  assert.equal((await api('buy',data)).item_id,receipt.item_id);
  await api('place',{itemId:receipt.item_id,roomId:room,x:2,y:2,z:0,rotation:2});
 }
 assert.equal(Number((await api('bootstrap')).balance),Number(after.balance)-spent);
 await clock('2026-11-03T00:00:00Z');
 const frozen=await api('bootstrap');const receipts=(await db.query('select * from earnly_world.purchase_receipts order by request_id')).rows;
 for(const {item,receipt,data}of bought){
  const d=frozen.catalog.find(d=>d.id===item.id);assert.equal(d.shop_available,false);assert.equal(frozen.items.some(i=>i.id===receipt.item_id),true);
  await assert.rejects(api('buy',{definitionId:item.id,requestId:crypto.randomUUID(),at:'2026-10-22Z',shop_available:true}),/seasonal item returns/);
  assert.equal((await api('buy',data)).item_id,receipt.item_id,'Off-season receipt replay');
  await assert.rejects(api('buy',{...data,color:null}),/Purchase ID reused/);
  for(const rotation of [0,2,4,6]){
   await api('place',{itemId:receipt.item_id,roomId:room,x:2,y:2,z:0,rotation});
   const snapshot=(await db.query('select public.world_room_snapshot($1,$2) r',[users[0],room])).rows[0].r;
   assert.equal(snapshot.items.find(i=>i.id===receipt.item_id).sprite,item.sprite_id);
   assert.equal(snapshot.items.find(i=>i.id===receipt.item_id).rotation,rotation);
  }
  await api('place',{itemId:receipt.item_id,roomId:room,pickup:true});
  assert.equal((await api('bootstrap')).items.find(i=>i.id===receipt.item_id).room_id,null);
  await api('place',{itemId:receipt.item_id,roomId:room,x:2,y:2,z:0,rotation:0});
 }
 const unchanged=await api('bootstrap');assert.equal(unchanged.balance,frozen.balance);assert.equal(unchanged.items.length,frozen.items.length);assert.deepEqual(unchanged.catalog,frozen.catalog);assert.deepEqual((await db.query('select * from earnly_world.purchase_receipts order by request_id')).rows,receipts);
 assert.equal(unchanged.items.some(i=>i.id===old),true,'Existing cauldron remains owned');
 for(const item of householdItems)await api('buy',{definitionId:item.id,requestId:crypto.randomUUID()});
 await api('buy',{definitionId:'cauldron',requestId:crypto.randomUUID()});
 await assert.rejects(api('buy',{definitionId:'vip-neon-throne',requestId:crypto.randomUUID()}),/VIP_GIFT_ONLY/);
 await clock('2027-10-01T00:00:00Z');assert.equal((await api('bootstrap')).catalog.find(d=>d.id===halloweenItems[0].id).shop_available,true);
 await api('buy',{definitionId:halloweenItems[0].id,requestId:crypto.randomUUID()});
 await apply(migration);assert.equal((await api('bootstrap')).items.length,unchanged.items.length+4,'Migration replay preserves minted/owned items');
 const privileges=(await db.query("select has_function_privilege('authenticated','public.world_api(uuid,text,jsonb)','EXECUTE') client,has_function_privilege('service_role','public.world_api(uuid,text,jsonb)','EXECUTE') server")).rows[0];assert.deepEqual(privileges,{client:false,server:true});
 for(const file of ['world.js','world-collections.js','world-renderer.js','world.html'])assert.equal(await readFile(file,'utf8'),await readFile('www/'+file,'utf8'),file+' parity');
 console.log(`PASS: ${boundaryCount} UTC boundaries across four years; 11 catalog definitions; real VIP/color/pet wrapper compatibility; 9 seasonal purchases/replays; off-season purchases rejected without mutations; 36 year-round saved rotations and pickup/re-placement; annual return; regular items; privileges; root/www parity.`);
}finally{await close();}
