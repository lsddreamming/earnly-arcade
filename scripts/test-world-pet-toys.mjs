import {worldFixture} from './world-test-fixture.mjs';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {SupabaseWorldAccess} from '../world-server/src/supabase-access.ts';
const f=await worldFixture({personalPets:true});
try{
 await f.db.exec(await readFile(new URL('../supabase/migrations/20261019232204_world_pet_toys.sql',import.meta.url),'utf8'));
 const actor=f.users[0],access=new SupabaseWorldAccess('https://world-test.invalid','fixture-key'),identity=await access.authenticate(actor),entered=await access.enter(identity,'home');entered.room.join(identity,entered.spawn,()=>{});
 let expected=3000;
 for(const [species,id,price,x] of [['dog','cloud-pup-ball',90,3],['cat','moon-cat-yarn',90,5],['rabbit','meadow-bunny-tunnel',150,7]]){
  const requestId=randomUUID();await access.perform(identity,entered.roomId,'buy',{definitionId:id,requestId});await access.perform(identity,entered.roomId,'buy',{definitionId:id,requestId});expected-=price;
  const items=(await f.db.query('select id from earnly_world.items where owner_id=$1 and definition_id=$2',[actor,id])).rows;assert.equal(items.length,1);
  await access.perform(identity,entered.roomId,'place',{itemId:items[0].id,x,y:5,rotation:0});assert.equal(entered.room.grid.tile({x,y:5}).petToy,species);
  const wallet=(await f.db.query('select balance from public.coin_wallets where user_id=$1',[actor])).rows[0];assert.equal(Number(wallet.balance),expected);
 }
 console.log('PASS: all toy purchases debit exact prices once, persist ownership and become usable immediately on placement.');
}finally{await f.close();}
