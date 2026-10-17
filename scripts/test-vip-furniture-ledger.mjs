import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
const {db,users,close}=await worldFixture();
try{
 await db.exec(`create table public.arcade_pass_transactions(provider text,transaction_id text,subscription_id text,user_id uuid,expires_at timestamptz,revoked boolean default false,primary key(provider,transaction_id));grant select on public.arcade_pass_transactions to service_role;`);
 await db.exec(await readFile('supabase/migrations/20261017022225_vip_furniture_gifts.sql','utf8'));
 const start=new Date(Date.now()-86400000).toISOString(),end=new Date(Date.now()+29*86400000).toISOString();
 const record=async(id,user=users[0],sub='sub_1')=>db.query('insert into arcade_pass_transactions(provider,transaction_id,subscription_id,user_id,expires_at) values($1,$2,$3,$4,$5)',['stripe',id,sub,user,end]);
 const award=async(id,user=users[0],sub='sub_1')=>(await db.query('select arcade_pass_furniture_award($1,$2,$3,$4,$5,$6) a',[user,'stripe',id,sub,start,end])).rows[0].a;
 const balance=(await db.query('select * from coin_wallets order by user_id')).rows;
 await assert.rejects(award('missing'),/VERIFIED_PAYMENT_REQUIRED/);
 await record('in_1');const a=await award('in_1');assert.ok(a.item_id);assert.deepEqual(await award('in_1'),a);
 await record('in_duplicate');assert.equal((await award('in_duplicate')).item_id,a.item_id);
 await assert.rejects(award('in_1',users[1]),/VERIFIED_PAYMENT_REQUIRED/);
 await assert.rejects(db.query("select world_api($1,'buy',$2)",[users[0],JSON.stringify({definitionId:a.definition_id,requestId:crypto.randomUUID()})]),/VIP_GIFT_ONLY/);
 assert.equal((await db.query('select tradeable from earnly_world.item_definitions where id=$1',[a.definition_id])).rows[0].tradeable,false);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(award('in_1'),/permission denied/);await assert.rejects(db.query('select * from arcade_pass_furniture_awards'),/permission denied/);await db.exec('reset role');}
 await db.query('update arcade_pass_transactions set revoked=true where transaction_id=$1',['in_1']);
 await db.query('select arcade_pass_furniture_revoke($1,$2,$3)',[users[0],'stripe','in_1']);
 assert.equal((await award('in_1')).revoked,true);
 assert.equal((await db.query('select gift_revoked from earnly_world.items where id=$1',[a.item_id])).rows[0].gift_revoked,true);
 const bootstrap=(await db.query("select world_api($1,'bootstrap') a",[users[0]])).rows[0].a;
 assert.equal(bootstrap.items.some(i=>i.id===a.item_id),false);
 await db.query("insert into earnly_world.items(owner_id,definition_id,serial,origin) select $1,'arcade-chair',10000+n,'earned' from generate_series(1,500) n",[users[1]]);
 await record('in_full',users[1],'sub_2');assert.equal((await award('in_full',users[1],'sub_2')).item_id,null);
 // Ending the subscription preserves an already-paid pending gift.
 await db.query("update arcade_pass_transactions set revoked=true where transaction_id='in_full'");
 await db.query("delete from earnly_world.items where owner_id=$1 and definition_id='arcade-chair' and serial=10001",[users[1]]);
 const recovered=await award('in_full',users[1],'sub_2');assert.ok(recovered.item_id);assert.equal((await award('in_full',users[1],'sub_2')).item_id,recovered.item_id);
 assert.deepEqual((await db.query('select * from coin_wallets order by user_id')).rows,balance);
 console.log('VIP ledger: verified ownership, transaction/period replay, forbidden coin purchase, non-tradeability, private RPCs, refund invalidation, pending-backpack recovery and untouched wallets passed.');
}finally{await close();}
