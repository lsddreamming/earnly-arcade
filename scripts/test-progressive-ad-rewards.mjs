import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite(),uid='00000000-0000-4000-8000-000000000001',legacy='00000000-0000-4000-8000-000000000002';
await db.exec(await readFile('tests/commerce-fixture.sql','utf8'));
await db.exec(`create role service_role bypassrls; alter table coin_wallets alter balance set default 0;
create table coin_ledger(id bigint generated always as identity primary key,user_id uuid,client_event_id text,source_type text constraint coin_ledger_source_type_check check(source_type in('game')),source_label text,game text,metric int,aux int,amount int,unique(user_id,client_event_id));`);
const baseline=await readFile('tests/kart-reward-baseline.sql','utf8');
await db.exec(baseline.slice(0,baseline.indexOf('$function$',baseline.indexOf('$function$')+10)+11)+';');
await db.exec(await readFile('supabase/migrations/20261021135638_daily_furniture_ad_bonus.sql','utf8'));
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const status=(user=uid)=>scalar('select ad_bonus_status($1)',[user]);
await db.exec('update ad_bonus_settings set enabled=true');
// Outstanding original tickets retain the original reward, even before a receipt.
const oldTicket=(await scalar("select ad_bonus_ticket($1,'bonusCoins')",[legacy])).ticket;
await db.exec(await readFile('supabase/migrations/20261021153607_progressive_ad_rewards.sql','utf8'));
assert.equal((await status(legacy)).coins,100);
assert.equal((await status()).coins,750);
assert.equal((await status()).earnedCoins,0);
const unit='ca-app-pub-8864401806510610/1831908609',extra='ca-app-pub-8864401806510610/8249888009';
const complete=(ticket,tx,ad=unit)=>scalar('select ad_bonus_complete($1,$2,$3,now())',[ticket,tx,ad]);
const ticket=async(user=uid,placement='bonusCoins')=>{
 await db.exec("update ad_bonus_tickets set created_at=now()-interval '2 minutes'");
 return (await scalar('select ad_bonus_ticket($1,$2)',[user,placement])).ticket;
};
const first=await ticket();
assert.equal(await complete(first,'wrong',extra),false);
assert.equal((await status()).earnedCoins,0);
for(let i=1;i<=5;i++){
 const t=i===1?first:await ticket(uid,i===2?'extraPlays':'bonusCoins');
 if(i===2){assert.equal(await complete(t,'tx-1',extra),false);assert.equal((await status()).watched,1);}
 assert.equal(await complete(t,'tx-'+i,i===2?extra:unit),true);
 await complete(t,'tx-'+i,i===2?extra:unit);
 const earned=i*100+(i===5?250:0);
 assert.equal((await status()).earnedCoins,earned);
 assert.equal(await scalar('select balance from coin_wallets where user_id=$1',[uid]),1250+earned);
}
assert.equal((await status()).awarded,true);
assert.equal(await ticket(),undefined);
assert.equal(await scalar('select count(*)::int from coin_ledger where user_id=$1',[uid]),8);
for(let i=1;i<=5;i++)await complete(i===1?oldTicket:await ticket(legacy),'old-'+i);
assert.equal((await status(legacy)).earnedCoins,100);
assert.equal(await scalar('select balance from coin_wallets where user_id=$1',[legacy]),2100);
// Moving yesterday's completed day leaves a fresh daily allowance.
await db.query("update ad_bonus_days set day=day-1 where user_id=$1",[uid]);
assert.equal((await status()).earnedCoins,0);
assert.equal((await status()).watched,0);
for(const role of ['anon','authenticated']){
 assert.equal(await scalar("select has_function_privilege($1,'public.ad_bonus_complete(uuid,text,text,timestamptz)','execute')",[role]),false);
 assert.equal(await scalar("select has_table_privilege($1,'public.ad_bonus_days','update')",[role]),false);
}
await db.close();
console.log('Progressive ads: per-ad payouts, fifth-ad bonus, deduplication, cap, mixed placements, legacy tickets, day reset and permissions passed.');
