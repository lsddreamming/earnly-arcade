import {worldFixture} from './world-test-fixture.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {db,users,close}=await worldFixture();const [uid,other]=users;
try{
 await db.exec(`alter table coin_wallets add column lifetime_earned bigint not null default 0;
 create table coin_ledger(id bigint generated always as identity primary key,user_id uuid,client_event_id text,source_type text,source_label text,game text,metric integer,aux integer,amount integer,created_at timestamptz default now(),unique(user_id,client_event_id),constraint coin_ledger_source_type_check check(source_type in ('game','daily_bonus','daily_challenge','legacy_seed')));
 grant usage on schema auth to service_role;grant select on auth.users,public.leaderboard_bans to service_role;grant select on coin_ledger to service_role;`);
 const baseline=await readFile(new URL('../tests/kart-reward-baseline.sql',import.meta.url),'utf8');await db.exec(baseline.split('CREATE OR REPLACE FUNCTION public.claim_coin_reward')[0]);
 await db.exec(await readFile(new URL('../supabase/migrations/20261019120514_world_daily_missions.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261030110345_world_daily_reward_rebalance.sql',import.meta.url),'utf8'));
 const status=async(claim=null,user=uid)=>(await db.query('select public.world_daily_missions($1,$2) r',[user,claim])).rows[0].r;
 assert.equal((await status()).missions.filter(m=>m.complete).length,0);
 assert.deepEqual((await status()).missions.map(m=>m.reward),[50,50,50]);
 await assert.rejects(status('visit'),/Complete the mission/);await assert.rejects(status('bogus'),/Unknown daily mission/);
 const plaza=(await db.query('select id from earnly_world.rooms where owner_id is null limit 1')).rows[0].id;
 await db.query('select public.world_daily_visit($1,$2)',[uid,plaza]);
 const home=(await db.query("select public.world_api($1,'create_room','{\"name\":\"Daily test\",\"layout\":\"classic\",\"firstRoom\":true}') r",[uid])).rows[0].r.roomId;
 await db.query('select public.world_daily_visit($1,$2)',[other,home]).catch(()=>{});
 assert.equal((await status(null,other)).missions.find(m=>m.id==='visit').complete,false);
 await db.query("select public.world_api($1,'buy',jsonb_build_object('definitionId','arcade-chair','requestId',gen_random_uuid()))",[uid]);
 const initialBalance=(await db.query('select balance from coin_wallets where user_id=$1',[uid])).rows[0].balance;
 const item=(await db.query('select id from earnly_world.items where owner_id=$1 limit 1',[uid])).rows[0].id;
 await db.query('update earnly_world.items set room_id=$2,x=2,y=2,z=0 where id=$1',[item,home]);
 assert.equal((await status()).missions.find(m=>m.id==='decorate').complete,true);
 await db.query("delete from earnly_world.daily_progress where user_id=$1 and mission='decorate'",[uid]);
 await db.query('update earnly_world.items set x=x where id=$1',[item]);
 assert.equal((await status()).missions.find(m=>m.id==='decorate').complete,false);
 await db.query('update earnly_world.items set x=3 where id=$1',[item]);
 await db.query("insert into coin_ledger(user_id,client_event_id,source_type,amount,created_at) values($1,'old-game','game',5,now()-interval '2 days'),($1,'zero-game','game',0,now()),($2,'other-game','game',5,now())",[uid,other]);
 assert.equal((await status()).missions.find(m=>m.id==='game').complete,false);
 await db.query("insert into coin_ledger(user_id,client_event_id,source_type,amount) values($1,'real-game','game',1)",[uid]);
 for(const id of ['visit','decorate','game'])await Promise.all([status(id),status(id),status(id)]);
 const wallet=(await db.query('select * from coin_wallets where user_id=$1',[uid])).rows[0];assert.equal(wallet.balance,initialBalance+150);assert.equal(wallet.lifetime_earned,150);assert.equal(wallet.purchased_balance,0);
 assert.equal((await status()).missions.filter(m=>m.claimed).length,3);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(status('visit'),/permission denied/);await assert.rejects(db.query('select public.world_daily_visit($1,$2)',[uid,plaza]),/permission denied/);await assert.rejects(db.query('select * from earnly_world.daily_progress'),/permission denied/);await db.exec('reset role');}
 await db.exec('set role service_role');assert.equal((await status('visit')).missions[0].claimed,true);await db.exec('reset role');
 // A claim made before the increase remains claimed at its actual 5-coin amount.
 await db.query("select public.apply_coin_ledger_event($1,'world-mission:'||(now() at time zone 'UTC')::date::text||':visit','world_mission','Visit',null,null,null,5)",[other]);
 const oldBalance=(await db.query('select balance from coin_wallets where user_id=$1',[other])).rows[0].balance;
 assert.equal((await status('visit',other)).missions[0].reward,5);
 assert.equal((await db.query('select balance from coin_wallets where user_id=$1',[other])).rows[0].balance,oldBalance);
 await db.query('insert into leaderboard_bans values($1)',[uid]);await assert.rejects(status('visit'),/Account unavailable/);
 console.log('PASS: daily missions validate public entry, actual decor changes, saved game earnings, account isolation, 150-coin cap, repeat claims, purchased balance preservation, role grants and bans.');
}finally{await close();}
