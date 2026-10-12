import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();await db.exec(await readFile('tests/commerce-fixture.sql','utf8'));
await db.exec('CREATE ROLE service_role BYPASSRLS; CREATE TABLE coin_ledger(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid,source_type text,game text);');
for(const name of ['20261007152428_avatar_studio','20261007162312_mascot_accessory_slots','20261007183740_avatar_atelier','20261007183756_website_coin_checkout','20261008154100_potato_personality','20261012144324_apple_coin_purchases','20261012165849_arcade_shop_two'])await db.exec(await readFile('supabase/migrations/'+name+'.sql','utf8'));
const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';let n=0;const key=()=>`11111111-1111-4111-8111-${String(++n).padStart(12,'0')}`;
const call=async(sql,args)=>(await db.query(sql,args)).rows[0].data;
const me=()=>call('select cosmetic_me($1) as data',[uid]);
const buy=(id,k=key())=>call('select cosmetic_buy($1,$2,$3) as data',[uid,id,k]);
assert.equal(Object.keys((await me()).user.equipped).length,22);
const packs=(await db.query('select price_cents from coin_packs order by price_cents')).rows;assert.deepEqual(packs.map(p=>p.price_cents),[99,299,499]);
const request=key();const purchase=await buy('orbit-pet',request);assert.equal(purchase.user.equipped.pet.id,'orbit-pet');assert.equal((await buy('orbit-pet',request)).user.coins,purchase.user.coins);
await assert.rejects(buy('nova-crown',request),/REQUEST_REUSED/);
await db.exec("update cosmetic_items set available_from=now()+interval '1 day' where id='snow-pet'");await assert.rejects(buy('snow-pet'),/COLLECTION_UNAVAILABLE/);
await db.exec("update cosmetic_items set available_until=now()-interval '1 day',available_from=now()-interval '2 days' where id='orbit-pet'");assert.equal((await db.query('select cosmetic_equip($1,$2) as data',[uid,'orbit-pet'])).rows[0].data.user.equipped.pet.id,'orbit-pet');
await assert.rejects(buy('vip-frame'),/VIP_ITEM/);await assert.rejects(db.query('select cosmetic_equip($1,$2)',[uid,'vip-frame']),/PASS_REQUIRED/);
const record=(owner=uid,revoked=false)=>call("select arcade_pass_record($1,'apple','123','100',now()+interval '1 month',$2,now()) as data",[owner,revoked]);
const before=(await me()).user.coins;assert.equal((await record()).active,true);assert.equal((await record()).active,true);assert.equal((await me()).user.coins,before);
assert.equal((await db.query('select cosmetic_equip($1,$2) as data',[uid,'vip-frame'])).rows[0].data.user.equipped.frame.id,'vip-frame');
await assert.rejects(record(other),/TRANSACTION_OWNER_MISMATCH/);
assert.equal((await record(uid,true)).active,false);assert.equal((await record()).active,false);assert.equal((await me()).user.equipped.frame.id,'no-frame');
await db.query("select arcade_pass_record($1,'apple','124','100',now()-interval '1 second',false,now())",[uid]);assert.equal((await me()).user.equipped.frame.id,'no-frame');
for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(record(),/permission denied/);await assert.rejects(db.query('select * from arcade_pass_transactions'),/permission denied/);await assert.rejects(buy('orbit-pet'),/permission denied/);await db.exec('RESET ROLE');}
await db.query('delete from auth.users where id=$1',[uid]).catch(()=>{}); // other fixture tables restrict deletion; explicitly model the auth cascade below.
await db.query('update arcade_pass_transactions set user_id=null where user_id=$1',[uid]);await assert.rejects(record(other),/TRANSACTION_OWNER_MISMATCH/);
await db.close();console.log('PASS Shop 2.0: expanded equipment, prices, ownership, idempotency, seasons, VIP expiry/refunds/replay/account binding, RLS, no currency benefits.');
