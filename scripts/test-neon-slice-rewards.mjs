import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),E=require('../neon-slice-engine.js');
assert.equal(await readFile('neon-slice-engine.js','utf8'),await readFile('supabase/functions/neon-slice/engine.js','utf8'));
for(let seed=1;seed<=25;seed++){
 const g=new E.Game(E.seededRandom(seed));g.start();const events=[];let ticks=0;
 while(g.state==='running'&&ticks<10800){
  if(ticks<1800)for(const o of [...g.items])if(!o.bomb&&o.y<500&&o.y>40&&o.x>0&&o.x<360){const x=Math.round(o.x),y=Math.round(o.y);events.push([ticks,Math.max(0,x-12),y,Math.min(360,x+12),y]);g.slice({x:Math.max(0,x-12),y},{x:Math.min(360,x+12),y});if(g.state!=='running')break;events.push([ticks]);g.endStroke();}
  if(g.state==='running'){g.step(1/60);ticks++;}
 }
 const r=E.verify(seed,events,ticks);assert.equal(r.score,g.score);assert(r.coins>0&&r.coins<=30);assert.throws(()=>E.verify(seed,events,ticks+1));assert.throws(()=>E.verify(seed,[[0,NaN,0,0,0]],ticks));assert.throws(()=>E.verify(seed,[[ticks+1]],ticks));
}
assert.throws(()=>E.verify(1,[],0));assert.throws(()=>E.verify(1,[],10801));assert.throws(()=>E.verify(1,[],1),/RUN_NOT_FINISHED/);
const db=new PGlite();await db.exec(await readFile('tests/commerce-fixture.sql','utf8'));
await db.exec(`CREATE ROLE service_role BYPASSRLS; ALTER TABLE coin_wallets ALTER balance SET DEFAULT 0;
CREATE TABLE coin_ledger(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid,client_event_id text,source_type text,source_label text,game text,metric int,aux int,amount int,created_at timestamptz DEFAULT now(),UNIQUE(user_id,client_event_id));
CREATE SCHEMA IF NOT EXISTS auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
CREATE TABLE coin_play_receipts(user_id uuid, request_id uuid, game text, action text);
CREATE TABLE coin_play_credits(user_id uuid, game text, remaining int);`);
await db.exec(await readFile('tests/kart-reward-baseline.sql','utf8'));
const file=(await readdir('supabase/migrations')).find(x=>x.endsWith('_neon_slice_verified_rewards.sql'));
await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const data=async(sql,args)=>(await db.query(sql,args)).rows[0].r;
const start=()=>data('select neon_slice_start($1,17) r',[uid]);
const claim=(id,score=1500,owner=uid)=>data('select neon_slice_claim($1,$2,$3,600) r',[owner,id,score]);
const age=id=>db.query("update neon_slice_rounds set created_at=now()-interval '5 minutes' where id=$1",[id]);
let round=await start();await assert.rejects(claim(round.id),/ROUND_TOO_FAST/);await assert.rejects(claim(round.id,1500,other),/ROUND_NOT_FOUND/);await age(round.id);
let r=await claim(round.id);assert.equal(r.amount,30);assert.equal(r.wallet.balance,'1280');assert.equal(r.remaining,2);
r=await claim(round.id);assert(r.duplicate);assert.equal(r.amount,0);assert.equal(r.wallet.balance,'1280');
const pending=await start();await age(pending.id);
for(const [score,coins] of [[0,0],[49,0],[50,1],[10000,30]]){round=await start();await age(round.id);r=await claim(round.id,score);assert.equal(r.amount,coins);}
assert((await start()).practice);r=await claim(pending.id);assert.equal(r.amount,0);assert.equal(r.remaining,0);
assert.equal((await db.query('select count(*)::int n from coin_ledger')).rows[0].n,3);
assert.equal(r.wallet.balance,'1311');
await db.exec("update neon_slice_rounds set claimed_at=now()-interval '1 day' where claimed_at is not null");
round=await start();assert(round.id);await db.query("update neon_slice_rounds set created_at=now()-interval '25 hours' where id=$1",[round.id]);await assert.rejects(claim(round.id),/ROUND_EXPIRED/);
for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(start(),/permission denied/);await assert.rejects(claim(round.id),/permission denied/);await assert.rejects(db.query('select * from neon_slice_rounds'),/permission denied/);await db.exec('RESET ROLE');}
await db.close();console.log('PASS: 25 deterministic replays, invalid inputs, unfinished runs, authoritative ledger, duplicate suppression, timing, ownership, daily cap including outstanding tickets, practice, rollover, expiry and client mint denial.');
