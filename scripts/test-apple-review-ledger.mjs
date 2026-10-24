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
// Purchase-test membership used to silently discard real scores. Recover only
// server-recorded runs and allow future submissions through the normal endpoint.
await db.exec(`ALTER TABLE coin_ledger ADD COLUMN metric integer, ADD COLUMN created_at timestamptz DEFAULT now();
 ALTER TABLE leaderboard_scores ADD COLUMN verified boolean DEFAULT false, ADD COLUMN updated_at timestamptz DEFAULT now();`);
for(const [game,metric] of [['jungleHopper',38],['snake',9],['snake',10],['memory',40],['memory',25],['unknown',999],['snake',2000000]]){
 await db.query("insert into coin_ledger(user_id,source_type,game,metric) values($1,'game',$2,$3)",[test,game,metric]);
}
await db.query("insert into coin_ledger(user_id,source_type,game,metric) values($1,'purchase','snake',900)",[test]);
const rankingMigration=await readFile('supabase/migrations/20261023211615_testflight_gameplay_rankings.sql','utf8');
// Banned accounts remain excluded from recovery.
await db.query('insert into leaderboard_bans(user_id) values($1)',[test]);
await db.exec(rankingMigration);
assert.equal((await db.query('select count(*)::int as n from leaderboard_scores where user_id=$1',[test])).rows[0].n,0);
await db.query('delete from leaderboard_bans where user_id=$1',[test]);
await db.exec(rankingMigration);
const recovered=(await db.query('select game,score,verified from leaderboard_scores where user_id=$1 order by game',[test])).rows;
assert.deepEqual(recovered,[{game:'jungleHopper',score:38,verified:true},{game:'memory',score:25,verified:true},{game:'snake',score:10,verified:true}]);
await db.query("update leaderboard_scores set score=50 where user_id=$1 and game='jungleHopper'",[test]);
await db.exec(rankingMigration);
assert.equal((await db.query("select score from leaderboard_scores where user_id=$1 and game='jungleHopper'",[test])).rows[0].score,50);
assert.equal((await db.query("select score from leaderboard_scores where user_id=$1 and game='snake'",[real])).rows[0].score,120);
await db.query("insert into leaderboard_scores(user_id,game,score) values($1,'spiralDrop',19)",[test]);
assert.equal((await db.query("select score from leaderboard_scores where user_id=$1 and game='spiralDrop'",[test])).rows[0].score,19);
await assert.rejects(db.query("select apple_coin_fulfill($1,'901','com.earnly.arcade.coins.starter','Production',false)",[test]),/PRODUCTION_ACCOUNT_REQUIRED/);
await assert.rejects(db.query("select coin_order_create($1,'starter','33333333-3333-4333-8333-333333333333')",[test]),/TEST_ACCOUNT_USE_APPLE_SANDBOX/);
console.log('PASS: TestFlight score recovery, score bounds, banned exclusion, lower-is-better, replay, new submissions and purchase isolation.');
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
