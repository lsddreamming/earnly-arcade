import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(await readFile('tests/commerce-fixture.sql','utf8'));
await db.exec('CREATE ROLE service_role BYPASSRLS; CREATE TABLE coin_ledger(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid,source_type text,game text);');
for(const name of ['20261007152428_avatar_studio','20261007162312_mascot_accessory_slots','20261007183740_avatar_atelier','20261007183756_website_coin_checkout','20261008154100_potato_personality','20261012144324_apple_coin_purchases','20261012165849_arcade_shop_two','20261013154102_apple_review_test_accounts'])await db.exec(await readFile('supabase/migrations/'+name+'.sql','utf8'));
const real='00000000-0000-4000-8000-000000000001',test='00000000-0000-4000-8000-000000000003';
await assert.rejects(db.query('insert into apple_sandbox_accounts(user_id) values($1)',[real]),/NEW_EMPTY_TEST_ACCOUNT_REQUIRED/);
await db.query('insert into auth.users values($1)',[test]);
await db.query("insert into profiles values($1,'AppleSandbox')",[test]);
await db.query('insert into coin_wallets(user_id,balance) values($1,0)',[test]);
await db.query('insert into apple_sandbox_accounts(user_id) values($1)',[test]);
const call=async(sql,args)=>(await db.query(sql,args)).rows[0].data;
const sandbox=(owner=test,id='900',revoked=false,environment='Sandbox')=>call('select apple_sandbox_coin_fulfill($1,$2,$3,$4,$5) as data',[owner,id,'com.earnly.arcade.coins.starter',environment,revoked]);
await assert.rejects(sandbox(real),/SANDBOX_TEST_ACCOUNT_REQUIRED/);
await assert.rejects(sandbox(test,'900',false,'Production'),/INVALID_TRANSACTION/);
assert.equal((await sandbox()).wallet.balance,'500');assert.equal((await sandbox()).wallet.balance,'500');
assert.equal((await sandbox()).wallet.lifetime_earned,'0');
await assert.rejects(db.query("select apple_coin_fulfill($1,'900','com.earnly.arcade.coins.starter','Production',false)",[test]),/PRODUCTION_ACCOUNT_REQUIRED/);
assert.equal((await call("select apple_coin_fulfill($1,'900','com.earnly.arcade.coins.starter','Production',false) as data",[real])).wallet.balance,'1750');
// Sandbox coins exercise the same cosmetics/extra-play paths, on the test account only.
await db.query("select cosmetic_buy($1,'orbit-pet','11111111-1111-4111-8111-111111111111')",[test]);
assert.equal((await sandbox(test,'900',true)).wallet.balance,'0');
assert.equal((await sandbox()).wallet.balance,'0');
assert.equal((await db.query('select balance from coin_wallets where user_id=$1',[real])).rows[0].balance,1750);
const vip=(owner=test,provider='apple_sandbox',revoked=false)=>call("select arcade_pass_record($1,$2,'900','900',now()+interval '1 day',$3,now()) as data",[owner,provider,revoked]);
await assert.rejects(vip(real),/PURCHASE_ENVIRONMENT_ACCOUNT_MISMATCH/);
await assert.rejects(vip(test,'apple'),/PURCHASE_ENVIRONMENT_ACCOUNT_MISMATCH/);
assert.equal((await vip()).active,true);
await db.query("select cosmetic_equip($1,'vip-frame')",[test]);
assert.equal((await vip(test,'apple_sandbox',true)).active,false);assert.equal((await vip()).active,false);
await assert.rejects(db.query("select coin_order_create($1,'starter','22222222-2222-4222-8222-222222222222')",[test]),/TEST_ACCOUNT_USE_APPLE_SANDBOX/);
await assert.rejects(db.query("select arcade_pass_reserve($1,'22222222-2222-4222-8222-222222222222')",[test]),/TEST_ACCOUNT_USE_APPLE_SANDBOX/);
await db.query("insert into leaderboard_scores(user_id,game,score) values($1,'snake',999999)",[test]);
assert.equal((await db.query('select count(*)::int as count from leaderboard_scores where user_id=$1',[test])).rows[0].count,0);
for(const role of ['anon','authenticated']){
 await db.exec('SET ROLE '+role);
 await assert.rejects(db.query('insert into apple_sandbox_accounts values($1,now())',[real]),/permission denied/);
 await assert.rejects(db.query('select * from apple_sandbox_accounts'),/permission denied/);
 await assert.rejects(sandbox(),/permission denied/);
 await db.exec('RESET ROLE');
}
// Retain receipt tombstones after account deletion: another account cannot replay.
await db.query('update apple_sandbox_coin_transactions set user_id=null where user_id=$1',[test]);
await assert.rejects(sandbox(),/TRANSACTION_OWNER_MISMATCH/);
await db.close();
console.log('PASS: dedicated test account enrollment, independent receipts, replay, refunds, VIP, real-wallet isolation, live-checkout exclusion, unranked scores and RLS.');
