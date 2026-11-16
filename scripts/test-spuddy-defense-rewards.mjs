import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),E=require('../spuddy-defense-engine.js');
assert.equal(await readFile('spuddy-defense-engine.js','utf8'),await readFile('supabase/functions/spuddy-defense/engine.js','utf8'),'server engine must match');
const db=new PGlite();await db.exec(await readFile('tests/commerce-fixture.sql','utf8'));
await db.exec(`CREATE ROLE service_role BYPASSRLS;ALTER TABLE coin_wallets ALTER balance SET DEFAULT 0;
CREATE TABLE coin_ledger(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid,client_event_id text,source_type text,source_label text,game text,metric int,aux int,amount int,created_at timestamptz DEFAULT now(),UNIQUE(user_id,client_event_id));
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
CREATE TABLE coin_play_receipts(user_id uuid,request_id uuid,game text,action text);
CREATE TABLE coin_play_credits(user_id uuid,game text,remaining int);`);
await db.exec(await readFile('tests/kart-reward-baseline.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261113082143_spuddy_defense_verified_runs.sql','utf8'));
const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const data=async(sql,args=[])=>(await db.query(sql,args)).rows[0].r;
const start=(options={})=>data('select spuddy_defense_start($1,$2) r',[uid,JSON.stringify(E.create(options).snapshot())]);
const age=id=>db.query("update spuddy_defense_runs set created_at=now()-interval '1 hour' where id=$1",[id]);
let round=await start();await assert.rejects(start({map:'city'}),/CONTENT_LOCKED/);await assert.rejects(start({mode:'hard'}),/CONTENT_LOCKED/);
const g=E.create();g.action({kind:'wave'});for(let i=0;i<900;i++)g.step();let s=g.snapshot();
const claim=(id,seq,snapshot,owner=uid)=>data('select spuddy_defense_checkpoint($1,$2,$3,$4,900) r',[owner,id,seq,JSON.stringify(snapshot)]);
await assert.rejects(claim(round.id,0,s),/ROUND_TOO_FAST/);await age(round.id);await assert.rejects(claim(round.id,0,s,other),/ROUND_NOT_FOUND/);
// SQL only receives server replay state; fixture advances that trusted state to exercise atomic accounting.
s.completed=10;s.mastery[0]=100;s.kills=100;s.bosses=1;
let r=await claim(round.id,0,s);assert.equal(r.amount,5);assert.equal(r.earned,5);assert.equal((await claim(round.id,0,s)).amount,0);await assert.rejects(claim(round.id,3,s),/SEQUENCE_CONFLICT/);
let p=await data('select spuddy_defense_profile($1) r',[uid]);assert.equal(p.profile.xp,250);assert.equal(p.profile.mastery[0],100);assert.equal(p.profile.bosses,1);assert.equal(p.run.sequence,1);assert.equal(p.profile.best['meadows:normal'].wave,10);
assert.equal((await data("select spuddy_defense_leaderboard('meadows','normal') r"))[0].wave,10);assert.equal((await data("select spuddy_defense_leaderboard('meadows','hard') r")).length,0);
await db.query('insert into leaderboard_bans values($1)',[uid]);assert.equal((await data("select spuddy_defense_leaderboard('meadows','normal') r")).length,0);await db.query('delete from leaderboard_bans');
s.tick=1800;s.completed=100;s.kills=900;s.phase='won';r=await claim(round.id,1,s);assert.equal(r.amount,45);assert.equal(r.finished,true);p=await data('select spuddy_defense_profile($1) r',[uid]);assert.equal(p.profile.wins,1);assert.equal(p.profile.mastery[0],100);assert.equal(p.run,null);
round=await start({map:'neon',mode:'hard'});await age(round.id);s={...E.create({map:'neon',mode:'hard'}).snapshot(),tick:900,completed:100,phase:'won'};assert.equal((await claim(round.id,0,s)).amount,10);
round=await start();await age(round.id);s={...E.create().snapshot(),tick:900,completed:100,phase:'won'};assert.equal((await claim(round.id,0,s)).amount,0);assert.equal((await db.query("select sum(amount)::int n from coin_ledger where game='spuddyDefense'")).rows[0].n,60);
// A new run closes the previous run, and another account cannot load this account's save.
const before=await start();await start();await assert.rejects(claim(before.id,0,s),/SEQUENCE_CONFLICT/);const stranger=await data('select spuddy_defense_profile($1) r',[other]);assert.deepEqual(stranger.profile.best,{});assert.equal(stranger.run,null);
for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(start(),/permission denied/);await assert.rejects(claim(round.id,0,s),/permission denied/);await assert.rejects(db.query('select * from spuddy_defense_runs'),/permission denied/);await assert.rejects(db.query('select spuddy_defense_profile($1)',[uid]),/permission denied/);await db.exec('RESET ROLE');}
await db.close();console.log('PASS defense SQL: ownership, cloud progress, CAS, retry idempotency, per-mode rankings, bans, 60/day cap, and denied browser minting');
