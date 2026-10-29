import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
import {RESIDENT_HOMES} from '../world-server/src/resident-homes.ts';
import {RoomGrid,parseHeightmap} from '../world-server/src/grid.ts';
import {canStep} from '../world-server/src/pathfinding.ts';
import {SupabaseWorldAccess} from '../world-server/src/supabase-access.ts';
const f=await worldFixture();
try{
 for(const name of ['20261017235224_world_catalog_expansion','20261018000633_world_dream_beds','20261018010214_world_themed_catalog_150','20261018152333_world_showcase_furniture','20261022213254_world_seasonal_halloween'])await f.db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
 const before=(await f.db.query('select user_id,balance,purchased_balance from public.coin_wallets order by user_id')).rows;
 const items=(await f.db.query('select count(*)::int n from earnly_world.items')).rows[0].n;
 const sql=await readFile(new URL('../supabase/migrations/20261029191500_world_resident_homes.sql',import.meta.url),'utf8');await f.db.exec(sql);await f.db.exec(sql);
 const facts=(await f.db.query('select public.world_resident_home_catalog() r')).rows[0].r;assert.equal(facts.length,10);assert.equal(new Set(facts.map(h=>h.roomId)).size,10);
 for(const home of RESIDENT_HOMES){
  const snapshot=(await f.db.query('select public.world_room_snapshot($1,$2) r',[f.users[0],home.roomId])).rows[0].r;
  assert.equal(snapshot.ownerId,null);assert.equal(snapshot.name,home.name);assert.equal(snapshot.items.length,15);
  const grid=new RoomGrid(parseHeightmap(snapshot.heightmap),snapshot.items);
  const seen=new Set(['0,0']),queue=[{x:0,y:0}];for(let i=0;i<queue.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const p=queue[i],q={x:p.x+dx,y:p.y+dy},key=q.x+','+q.y;if(!seen.has(key)&&canStep(grid,p,q,{diagonal:false})){seen.add(key);queue.push(q);}}
  for(let y=0;y<14;y++)for(let x=0;x<14;x++)if(grid.tile({x,y})?.walkable)assert.ok(seen.has(x+','+y),'all floor connected: '+home.name);
  const fact=facts.find(h=>h.roomId===home.roomId);assert.equal(fact.animatedFish,true);assert.deepEqual(fact.items,snapshot.items.map(i=>i.name));
 }
 assert.deepEqual((await f.db.query('select user_id,balance,purchased_balance from public.coin_wallets order by user_id')).rows,before);
 assert.equal((await f.db.query('select count(*)::int n from earnly_world.items')).rows[0].n,items,'no tradable items minted');
 const prior=globalThis.fetch;globalThis.fetch=async(url,options)=>String(url).endsWith('/world_resident_home_catalog')?Response.json((await f.db.query('select public.world_resident_home_catalog() r')).rows[0].r):prior(url,options);
 const access=new SupabaseWorldAccess('https://world-test.invalid','fixture-key');const home=RESIDENT_HOMES[2],identity={userId:f.users[0],username:'Player'};
 const entry=await access.enter(identity,home.roomId);assert.equal(entry.scene.residentHost,'mochi');assert.equal(entry.scene.chatRange,'room');assert.equal(entry.room.roomWideChat,true);assert.equal(entry.bootstrap.residentHomes.length,10);assert.deepEqual(entry.room.spuds.snapshots().map(s=>s.residentId),['mochi']);
 entry.room.join(identity,entry.spawn,()=>{});for(let i=0;i<10;i++)entry.room.join({userId:'crowd'+i,username:'Visitor'},entry.room.availableSpawn(),()=>{});for(let i=0;i<200;i++)entry.room.tick();assert.deepEqual(entry.room.spuds.snapshots().map(s=>s.residentId),['mochi'],'host stays when busy');
 await assert.rejects(access.perform(identity,home.roomId,'resident_dismiss',{residentId:'mochi'}),/own room/);
 await assert.rejects(f.db.query("select public.world_api($1,'room_access',$2::jsonb)",[identity.userId,JSON.stringify({roomId:home.roomId,access:'closed'})]),/room|owner|Action/i);
 const privileges=(await f.db.query("select has_function_privilege('anon','public.world_resident_home_catalog()','EXECUTE') anon,has_function_privilege('authenticated','public.world_resident_home_catalog()','EXECUTE') authenticated,has_function_privilege('service_role','public.world_resident_home_catalog()','EXECUTE') service")).rows[0];assert.deepEqual(privileges,{anon:false,authenticated:false,service:true});
 console.log('Resident homes: ten furnished catalog rooms, connected floor, aquarium facts, persistent host, no charges/minting, owner and role isolation passed');
}finally{await f.close();}
