import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite(),uid='00000000-0000-4000-8000-000000000001';
await db.exec(await readFile('tests/commerce-fixture.sql','utf8'));
await db.exec(`create role service_role bypassrls; alter table coin_wallets alter balance set default 0;
create table coin_ledger(id bigint generated always as identity primary key,user_id uuid,client_event_id text,source_type text constraint coin_ledger_source_type_check check(source_type in('game')),source_label text,game text,metric int,aux int,amount int,unique(user_id,client_event_id));`);
const baseline=await readFile('tests/kart-reward-baseline.sql','utf8');await db.exec(baseline.slice(0,baseline.indexOf('$function$',baseline.indexOf('$function$')+10)+11)+';');
await db.exec(await readFile('supabase/migrations/20261021135638_daily_furniture_ad_bonus.sql','utf8'));
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const status=()=>scalar('select ad_bonus_status($1)',[uid]);
assert.equal((await status()).enabled,false);
assert.equal((await scalar("select ad_bonus_ticket($1,'bonusCoins')",[uid])).ticket,undefined);
await db.exec('update ad_bonus_settings set enabled=true');
const tickets=[];
for(let i=0;i<3;i++)tickets.push((await scalar("select ad_bonus_ticket($1,'bonusCoins')",[uid])).ticket);
await assert.rejects(scalar("select ad_bonus_ticket($1,'bonusCoins')",[uid]),/TRY_LATER/);
await db.exec("update ad_bonus_tickets set created_at=now()-interval '2 minutes'");
for(let i=0;i<3;i++)tickets.push((await scalar("select ad_bonus_ticket($1,'bonusCoins')",[uid])).ticket);
const unit='ca-app-pub-8864401806510610/1831908609';
const complete=(ticket,tx,ad=unit)=>scalar('select ad_bonus_complete($1,$2,$3,now())',[ticket,tx,ad]);
assert.equal(await complete(tickets[0],'wrong','ca-app-pub-8864401806510610/8249888009'),false);
assert.equal((await status()).watched,0);
for(let i=0;i<4;i++){assert.equal(await complete(tickets[i],'tx-'+i),true);await complete(tickets[i],'tx-'+i);assert.equal((await status()).watched,i+1);}
assert.equal(await scalar('select balance from coin_wallets where user_id=$1',[uid]),1250);
assert.equal(await complete(tickets[4],'tx-0'),false); // transaction replay with a different ticket
assert.equal((await status()).watched,4);
await complete(tickets[4],'tx-4');await complete(tickets[5],'tx-5');await complete(tickets[4],'tx-4');
assert.equal((await status()).watched,5);assert.equal((await status()).awarded,true);
assert.equal(await scalar('select balance from coin_wallets where user_id=$1',[uid]),1350);
assert.equal(await scalar('select count(*)::int from coin_ledger'),1);
assert.equal((await scalar("select ad_bonus_ticket($1,'bonusCoins')",[uid])).ticket,undefined);
assert.equal((await scalar('select ad_bonus_status($1)',['00000000-0000-4000-8000-000000000002'])).watched,0);
for(const role of ['anon','authenticated']){
 assert.equal(await scalar("select has_function_privilege($1,'public.ad_bonus_complete(uuid,text,text,timestamptz)','execute')",[role]),false);
 assert.equal(await scalar("select has_table_privilege($1,'public.ad_bonus_days','update')",[role]),false);
}
await db.close();console.log('Daily boost ledger: capped reward, replay resistance, account isolation, rate limit and permissions passed.');
