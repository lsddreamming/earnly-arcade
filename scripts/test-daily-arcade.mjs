import {worldFixture} from './world-test-fixture.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const {db,users:[uid,other],close}=await worldFixture();
try{
 await db.exec(`alter table earnly_world.items add column gift_revoked boolean not null default false;
 create table public.coin_ledger(user_id uuid,client_event_id text,source_type text,game text,metric integer,amount integer,unique(user_id,client_event_id));
 grant select,update on public.coin_wallets to service_role;
 grant usage on schema auth to service_role;grant select on auth.users,public.leaderboard_bans to service_role;
 create function public.challenge_test_now() returns timestamptz language sql as $$select current_setting('test.clock')::timestamptz$$;`);
 await db.query("select set_config('test.clock','2026-11-02T12:00:00Z',false)");
 const sql=await readFile(new URL('../supabase/migrations/20261104145627_daily_arcade_challenge.sql',import.meta.url),'utf8');
 await db.exec(sql.replaceAll('now()','public.challenge_test_now()'));
 const status=async(id=uid)=>(await db.query('select public.arcade_challenge_status($1) result',[id])).rows[0].result;
 const result=async(game,metric,id=uid,event=randomUUID(),kind='game')=>db.query('insert into coin_ledger values($1,$2,$3,$4,$5,0) on conflict do nothing',[id,event,kind,game,metric]);
 const clock=async(date)=>db.query("select set_config('test.clock',$1,false)",[date+'T12:00:00Z']);
 const complete=async()=>{for(const g of (await status()).goals)await result(g.game,g.goal);};
 let s=await status();assert.equal(s.goals.length,3);assert.equal(s.days.length,0);assert.equal(s.totalAwards,0);
 const g=s.goals[0],event=randomUUID();await result(g.game,g.goal-1,uid,event);await result(g.game,g.goal,uid,event);
 assert.equal((await status()).goals[0].progress,g.goal-1,'duplicate receipt cannot advance');
 await result(g.game,g.goal,uid,randomUUID(),'daily_bonus');assert.equal((await status()).goals[0].progress,g.goal-1,'bonuses do not count');
 await result(g.game,g.goal);await result(g.game,1);assert.equal((await status()).goals[0].progress,g.goal,'best result never decreases');
 await complete();await complete();assert.equal((await status()).days.length,1,'one stamp per day');
 assert.equal((await status(other)).days.length,0,'account isolation');
 await clock('2026-11-04');assert.equal((await status()).goals.filter(g=>g.progress).length,0);await complete();
 await clock('2026-11-06');await complete();assert.equal((await status()).totalAwards,0);
 await clock('2026-11-08');await complete();s=await status();assert.equal(s.days.length,4);assert.equal(s.delivered,true);assert.equal(s.totalAwards,1);
 await Promise.all([status(),status(),status()]);assert.equal((await db.query("select count(*)::int n from earnly_world.items where definition_id='arcade-weekly-cup' and owner_id=$1",[uid])).rows[0].n,1);
 const definition=(await db.query("select * from earnly_world.item_definitions where id='arcade-weekly-cup'")).rows[0];assert.equal(definition.tradeable,false);assert.equal(definition.challenge_only,true);
 await assert.rejects(db.query("select public.world_api($1,'buy',$2::jsonb)",[uid,JSON.stringify({definitionId:'arcade-weekly-cup',requestId:randomUUID()})]),/CHALLENGE_REWARD_ONLY/);
 await clock('2026-11-09');s=await status();assert.equal(s.days.length,0);assert.equal(s.delivered,false);assert.equal(s.totalAwards,1,'owned prizes survive reset');
 // Capacity blocks delivery, not entitlement, which survives into a later week.
 await db.query("insert into earnly_world.items(owner_id,definition_id,serial,origin) select $1,'arcade-weekly-cup',1000+n,'earned' from generate_series(1,499)n",[uid]);
 for(const day of ['2026-11-09','2026-11-10','2026-11-12','2026-11-14']){await clock(day);await complete();}
 s=await status();assert.equal(s.pending,true);assert.equal(s.totalAwards,1);
 await clock('2026-11-16');await db.query("delete from earnly_world.items where owner_id=$1 and serial=1001",[uid]);s=await status();assert.equal(s.pending,false);assert.equal(s.totalAwards,2);
 await db.query("delete from earnly_world.items where owner_id=$1 and serial<1000",[uid]);await status();assert.equal((await db.query("select count(*)::int n from earnly_world.items where owner_id=$1 and serial<1000",[uid])).rows[0].n,0,'deleted trophy cannot be reminted');
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);await assert.rejects(status(),/permission denied/);
  await assert.rejects(db.query('select * from earnly_world.arcade_challenge_days'),/permission denied/);
  await assert.rejects(db.query('insert into earnly_world.arcade_challenge_days values($1,current_date)',[other]),/permission denied/);await db.exec('reset role');
 }
 await db.exec('set role service_role');await status();await db.exec('reset role');
 await db.query('insert into leaderboard_bans values($1)',[uid]);await assert.rejects(status(),/Account unavailable/);
 // Security advisor equivalents for the additive objects, without touching production.
 const tables=(await db.query("select relrowsecurity from pg_class where relname like 'arcade_challenge_%' and relkind='r'")).rows;assert.equal(tables.length,3);assert(tables.every(t=>t.relrowsecurity));
 assert.equal((await db.query("select count(*)::int n from pg_proc where proname in ('arcade_challenge_status','arcade_challenge_goals','record_arcade_challenge') and prosecdef")).rows[0].n,0);
 console.log('PASS: daily rotation, maxima, duplicate receipts, skipped days, UTC week rollover, account isolation, one trophy per week, capacity retry after rollover, deleted trophy idempotency, role boundaries, RLS, bans and purchase denial.');
}finally{await close();}
