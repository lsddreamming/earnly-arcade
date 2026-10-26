import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),E=require('../bubble-pop-engine.js');
require('../supabase/functions/bubble-pop/engine.js');const verify=require('../supabase/functions/bubble-pop/verify.js');
assert.equal(await readFile('bubble-pop-engine.js','utf8'),await readFile('supabase/functions/bubble-pop/engine.js','utf8'));
for(const level of [0,1,9,99,999]){
 let tested=false;
 for(let seed=1;seed<200&&!tested;seed++){
  const g=E.create(E.seededRandom(seed),level),steps=[],choose=E.seededRandom(seed+9000);
  while(!g.state().done){const moves=g.legalMoves(),move=moves[Math.floor(choose()*moves.length)];steps.push(move);g.swap(...move);}
  if(g.state().status!=='won')continue;
  const result=verify({seed,level},steps);assert.equal(result.stars,g.state().moves>=8?3:g.state().moves>=3?2:1);assert.equal(result.turns,steps.length);
  assert.throws(()=>verify({seed,level},[]));assert.throws(()=>verify({seed,level},[[-1,100]]));assert.throws(()=>verify({seed,level},[...steps,[0,1]]));tested=true;
 }
 assert(tested,'must exercise a verified win at '+level);
}
const db=new PGlite();await db.exec(await readFile('tests/commerce-fixture.sql','utf8'));
await db.exec(`CREATE ROLE service_role BYPASSRLS; ALTER TABLE coin_wallets ALTER balance SET DEFAULT 0;
CREATE TABLE coin_ledger(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid,client_event_id text,source_type text,source_label text,game text,metric int,aux int,amount int,created_at timestamptz DEFAULT now(),UNIQUE(user_id,client_event_id));
CREATE SCHEMA IF NOT EXISTS auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
CREATE TABLE coin_play_receipts(user_id uuid, request_id uuid, game text, action text);
CREATE TABLE coin_play_credits(user_id uuid, game text, remaining int);`);
await db.exec(await readFile('tests/kart-reward-baseline.sql','utf8'));
const file=(await readdir('supabase/migrations')).find(x=>x.endsWith('_bubble_pop_verified_rewards.sql'));
await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const data=async(sql,args)=>(await db.query(sql,args)).rows[0].r;
const start=async(level=0)=>data('select bubble_pop_start($1,$2,17) r',[uid,level]);
const claim=(id,stars=3,owner=uid)=>data('select bubble_pop_claim($1,$2,$3,1) r',[owner,id,stars]);
const age=async(id)=>db.query("update bubble_pop_rounds set created_at=now()-interval '1 minute' where id=$1",[id]);
let round=await start();await assert.rejects(claim(round.id),/ROUND_TOO_FAST/);await assert.rejects(claim(round.id,3,other),/ROUND_NOT_FOUND/);await age(round.id);
let r=await claim(round.id);assert.equal(r.amount,35);assert.equal(r.bonus,0);assert.equal(r.wallet.balance,'1285');assert.equal(r.wallet.lifetime_earned,'35');
const retry=await claim(round.id);assert(retry.duplicate);assert.equal(retry.amount,0);assert.equal(retry.wallet.balance,'1285');
const replay=await start();await age(replay.id);assert((await claim(replay.id,1)).duplicate);
round=await start(9);await age(round.id);await assert.rejects(claim(round.id),/LEVEL_LOCKED/);
for(const [level,stars,want] of [[1,1,15],[2,2,25]]){round=await start(level);await age(round.id);r=await claim(round.id,stars);assert.equal(r.amount,want);assert.equal(r.bonus,0);}
for(let level=3;level<=8;level++){round=await start(level);await age(round.id);await claim(round.id);}
round=await start(9);assert.equal(round.nextRewardLevel,9);await age(round.id);await assert.rejects(claim(round.id),/DAILY_REWARD_LIMIT/);
assert.equal((await db.query('select count(*)::int n from bubble_pop_rewards')).rows[0].n,9);
assert.equal((await db.query('select claimed_at from bubble_pop_rounds where id=$1',[round.id])).rows[0].claimed_at,null);
await db.query("update coin_ledger set created_at=now()-interval '1 day'");r=await claim(round.id,2);assert.equal(r.amount,25);assert.equal(r.bonus,100);assert.equal((await claim(round.id)).amount,0);
assert.equal((await db.query("select count(*)::int n from coin_ledger where client_event_id like 'bubble-pop:milestone:%'")).rows[0].n,1);
round=await start(10);await db.query("update bubble_pop_rounds set created_at=now()-interval '25 hours' where id=$1",[round.id]);await assert.rejects(claim(round.id),/ROUND_EXPIRED/);
for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(start(),/permission denied/);await assert.rejects(claim(round.id),/permission denied/);await assert.rejects(db.query('select * from bubble_pop_rounds'),/permission denied/);await assert.rejects(db.query('select * from bubble_pop_rewards'),/permission denied/);await db.exec('RESET ROLE');}
await db.close();console.log('PASS: engine replay; 1/2/3 stars; milestone; first-clear/replay idempotency; wallet/lifetime totals; ownership; sequential campaign eligibility; timing; expiry; 9-round daily cap with atomic bonus; denied client minting.');
