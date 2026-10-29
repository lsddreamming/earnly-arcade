import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import catalog from '../world-collections.js';
const read=p=>readFile(p,'utf8'),db=new PGlite();
await db.exec(await read('tests/commerce-fixture.sql'));
await db.exec(`CREATE ROLE service_role BYPASSRLS; ALTER TABLE coin_wallets ALTER balance SET DEFAULT 0;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE coin_ledger(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid,client_event_id text,source_type text,source_label text,game text,metric integer,aux integer,amount integer,created_at timestamptz DEFAULT now(),UNIQUE(user_id,client_event_id));
CREATE SCHEMA earnly_world;
CREATE TABLE earnly_world.item_definitions(id text primary key,name text,sprite_id text,item_height numeric,price int,width int,length int,can_sit boolean,can_lay boolean,can_stack boolean,walkable boolean,category text,color text);
INSERT INTO earnly_world.item_definitions(id,price) values('starter-chair',60);`);
await db.exec(await read('supabase/migrations/20261007183756_website_coin_checkout.sql'));
await db.exec(await read('tests/kart-reward-baseline.sql'));
await db.exec(await read('supabase/migrations/20261015210446_crystal_command_coin_rewards.sql'));
const migration=await read('supabase/migrations/20261021154706_balanced_arcade_economy.sql');
await db.exec(migration);await db.exec(migration);
const pacing=await read('supabase/migrations/20261023182050_jungle_hopper_reward_pacing.sql');
await db.query("select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false)");
const historical=(await db.query("select claim_coin_reward('before-pacing','game','jungleHopper',30,0) r")).rows[0].r;
assert.equal(historical.amount,100);
await db.exec(pacing);await db.exec(pacing);
const oldRetry=(await db.query("select claim_coin_reward('before-pacing','game','jungleHopper',30,0) r")).rows[0].r;
assert.equal(oldRetry.amount,100);assert(oldRetry.duplicate);assert.equal(oldRetry.wallet.balance,historical.wallet.balance);

const towerBefore=(await db.query("select claim_coin_reward('tower-before-pacing','game','towerStack',33,33) r")).rows[0].r;
assert.equal(towerBefore.amount,100);
const towerMigration=(await readdir('supabase/migrations')).find(x=>x.endsWith('_tower_reward_pacing.sql'));
const towerSql=await read('supabase/migrations/'+towerMigration);await db.exec(towerSql);await db.exec(towerSql);
const towerRetry=(await db.query("select claim_coin_reward('tower-before-pacing','game','towerStack',33,33) r")).rows[0].r;
assert(towerRetry.duplicate);assert.equal(towerRetry.amount,100);assert.deepEqual(towerRetry.wallet,towerBefore.wallet);

const src=await read('arcade.js'),fn=src.slice(src.indexOf('  function gameReward('),src.indexOf('  // END BALANCED GAME REWARDS'));
const reward=vm.runInNewContext('('+fn.trim()+')');
const games=[...fn.matchAll(/case '([^']+)'/g)].map(m=>m[1]);
const uid='00000000-0000-4000-8000-000000000001';await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
let count=0;
for(const game of games){
 for(const [m,a] of game==='towerStack'?[[0,0],[1,1],[3,0],[15,5],[33,33],[60,40],[100,100],[10000,10000]]:[[0,0],[1,1],[5,2],[15,5],[30,12],[75,20],[250,60],[10000,10000]]){
  if(game==='memory'&&m===0||game==='crystalCommand'&&(m<1||a<60))continue;
  const id='balance-test-'+(++count);
  const r=(await db.query("select claim_coin_reward($1,'game',$2,$3,$4,null,'balance test') r",[id,game,m,a])).rows[0].r;
  assert.equal(r.amount,reward(game,m,a),`${game} ${m}/${a}`);
  assert(r.amount>=0&&r.amount<=100);
  const duplicate=(await db.query("select claim_coin_reward($1,'game',$2,$3,$4,null,'balance test') r",[id,game,m,a])).rows[0].r;
  assert(duplicate.duplicate);assert.equal(duplicate.wallet.balance,r.wallet.balance);
 }
}
for(const [game,m,a,want] of [['jungleHopper',30,0,25],['jungleHopper',30,10,35],['jungleHopper',100,99,50],['snake',25,0,39],['blockDrop',10,0,45],['starDefender',1200,0,60],['coinCatch',75,0,28],['crystalCommand',45,120,100]])assert.equal(reward(game,m,a),want);
for(const [m,a,want] of [[3,0,1],[33,0,13],[33,33,16],[36,33,17],[60,40,29],[100,100,53],[210,210,100]])assert.equal(reward('towerStack',m,a),want);
for(const item of catalog.premiumItems){const row=(await db.query('select * from earnly_world.item_definitions where id=$1',[item.id])).rows[0];for(const k of ['price','sprite_id','width','length','category'])assert.equal(row[k],item[k]);}
assert.equal((await db.query("select price from earnly_world.item_definitions where id='starter-chair'")).rows[0].price,60);
const daily=(await db.query("select claim_coin_reward('daily-balance-check','daily_bonus') r")).rows[0].r;assert.equal(daily.amount,10);
await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(db.query("select claim_coin_reward('signed-out-check','game','snake',30)"),/Sign in required/);
await db.close();console.log(`PASS: ${count} game/server payout and duplicate checks across ${games.length} games; premium prices and unchanged starter price; migration replay; daily bonus and authentication.`);
