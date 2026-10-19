import assert from 'node:assert/strict';
import {worldFixture} from './world-test-fixture.mjs';
import {SupabaseWorldAccess} from '../world-server/src/supabase-access.ts';
const {db,users,close}=await worldFixture({personalPets:true});
const api=async(actor,action,data={})=>(await db.query('select public.world_api($1,$2,$3::jsonb) result',[actor,action,JSON.stringify(data)])).rows[0].result;
const pets=async(actor,room,action,data={})=>(await db.query('select public.world_pets($1,$2,$3,$4::jsonb) result',[actor,room,action,JSON.stringify(data)])).rows[0].result;
try{
 const owner=users[0],guest=users[1],home=(await api(owner,'create_room',{name:'Pet home'})).roomId;
 const other=(await api(guest,'create_room',{name:'Other home'})).roomId;
 await db.query('update public.coin_wallets set purchased_balance=700 where user_id=$1',[owner]);
 const request={species:'dog',requestId:crypto.randomUUID()},bought=await pets(owner,home,'buy',request);
 assert.equal(bought.price,500);assert.equal(bought.purchased_coins,500);
 assert.deepEqual(await pets(owner,home,'buy',request),bought);
 await assert.rejects(pets(owner,home,'buy',{...request,species:'cat'}),/reused/);
 let wallet=(await db.query('select * from public.coin_wallets where user_id=$1',[owner])).rows[0];assert.equal(wallet.balance,2500);assert.equal(wallet.purchased_balance,200);
 const cat=await pets(owner,home,'buy',{species:'cat',requestId:crypto.randomUUID()});assert.equal(cat.purchased_coins,200);
 const rabbit=await pets(owner,home,'buy',{species:'rabbit',requestId:crypto.randomUUID()});
 const extra=await pets(owner,home,'buy',{species:'rabbit',requestId:crypto.randomUUID()});
 for(const pet of [bought,cat,rabbit])await pets(owner,home,'place',{petId:pet.pet_id});
 await assert.rejects(pets(owner,home,'place',{petId:extra.pet_id}),/three/);
 await assert.rejects(pets(guest,home,'pickup',{petId:bought.pet_id}),/unavailable/);
 await assert.rejects(pets(owner,other,'place',{petId:extra.pet_id}),/own room/);
 await pets(owner,home,'rename',{petId:bought.pet_id,name:'Biscuit Jr'});
 await assert.rejects(pets(owner,home,'rename',{petId:bought.pet_id,name:'<script>'}),/letters/);
 const access=new SupabaseWorldAccess('https://world-test.invalid','fixture-key'),identity={userId:owner,username:'Owner'};
 const entry=await access.enter(identity,home),visitor=await access.enter({userId:guest,username:'Guest'},home);
 const packets=[];entry.room.join(identity,entry.spawn,p=>packets.push(p));entry.room.join({userId:guest,username:'Guest'},entry.room.availableSpawn(),()=>{});
 assert.equal(entry.room,visitor.room);assert.equal(entry.room.staff().length,3);assert.equal(entry.bootstrap.petsEnabled,true);
 const seen=new Set();for(let i=0;i<800;i++){entry.room.tick();for(const p of entry.room.staff()){assert(entry.room.grid.tile(p.position).walkable);seen.add(p.staffId+JSON.stringify(p.position));}}
 assert(seen.size>12);assert.equal(entry.room.members().length,2);
 const picked=await access.perform(identity,home,'pet_pickup',{petId:bought.pet_id});assert.equal(entry.room.staff().length,2);assert.equal(picked.deliveries[0].packet.type,'NPC_SNAPSHOT');
 await access.perform(identity,home,'pet_place',{petId:extra.pet_id});assert.equal(entry.room.staff().length,3);
 const renamed=await access.perform(identity,home,'pet_rename',{petId:extra.pet_id,name:'Clover'});assert(renamed.deliveries[0].packet.staff.some(p=>p.username==='Clover'));
 await assert.rejects(access.perform({userId:guest,username:'Guest'},home,'pet_pickup',{petId:extra.pet_id}),/Pet unavailable/);
 const restarted=new SupabaseWorldAccess('https://world-test.invalid','fixture-key');const reconnect=await restarted.enter(identity,home);assert.equal(reconnect.room.staff().length,3);assert(reconnect.room.staff().some(p=>p.username==='Clover'));
 await api(owner,'room_access',{roomId:home,access:'closed'});await assert.rejects(pets(guest,home,'buy',{species:'dog',requestId:crypto.randomUUID()}));
 await db.query('update public.coin_wallets set balance=0,purchased_balance=0 where user_id=$1',[owner]);
 await assert.rejects(pets(owner,home,'buy',{species:'dog',requestId:crypto.randomUUID()}),/Not enough/);
 await db.query('select public.world_delete_room($1,$2)',[owner,home]);const stored=(await api(owner,'bootstrap')).pets;assert.equal(stored.length,4);assert(stored.every(p=>p.room_id===null));
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(pets(owner,other,'buy',{species:'dog',requestId:crypto.randomUUID()}),/permission/);await assert.rejects(db.query('select * from earnly_world.pets'),/permission/);await db.exec('reset role');}
 console.log('PASS: pet purchase retries, exact purchased/earned spending, ownership, names, room limits, synchronized roaming, live pickup/rename, restart persistence, private rooms, insufficient funds, deletion preservation, and client permissions.');
}finally{await close();}
