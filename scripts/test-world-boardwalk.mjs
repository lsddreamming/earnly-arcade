import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {worldFixture} from './world-test-fixture.mjs';
const fixture=await worldFixture();
try {
 const db=fixture.db,uid=fixture.users[0];
 await db.exec('create table public.cosmetic_items(id text primary key,name text,slot text,coin_price int,rarity text,asset_path text,collection text)');
 const sql=await readFile('supabase/migrations/20261016140648_neon_boardwalk_collection.sql','utf8');
 const before=(await db.query('select * from coin_wallets order by user_id')).rows;
 await db.exec(sql);await db.exec(sql);
 assert.deepEqual((await db.query('select * from coin_wallets order by user_id')).rows,before);
 assert.equal((await db.query('select count(*)::int n from cosmetic_items')).rows[0].n,5);
 const api=async(action,data={})=>(await db.query('select public.world_api($1,$2,$3::jsonb) result',[uid,action,JSON.stringify(data)])).rows[0].result;
 const catalog=(await api('bootstrap')).catalog.filter(i=>i.category==='Neon Boardwalk');assert.equal(catalog.length,4);
 for(const item of catalog){const requestId=randomUUID(),buy=await api('buy',{definitionId:item.id,requestId});assert.equal((await api('buy',{definitionId:item.id,requestId})).item_id,buy.item_id);}
 assert.equal(Number((await api('bootstrap')).balance),3000-390);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query("update earnly_world.item_definitions set price=0 where id='boardwalk-sofa'"),/permission denied/);await db.exec('reset role');}
 console.log('PASS: additive catalog preserves wallets; four decor purchases debit exactly once; unauthorized catalog writes rejected.');
}finally{await fixture.close();}
