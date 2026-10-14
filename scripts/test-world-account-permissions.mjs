import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
const fixture=await worldFixture();
const {db,users}=fixture;
try {
 // Match hosted Supabase: service_role has public table access, but no auth.users SELECT.
 await db.exec('grant usage on schema auth to service_role; grant all on all tables in schema public to service_role; alter table auth.users add column encrypted_password text;');
 const api=async(action,data={})=>(await db.query('select public.world_api($1,$2,$3::jsonb) result',[users[0],action,JSON.stringify(data)])).rows[0].result;
 await db.exec('set role service_role');
 await assert.rejects(api('bootstrap'),/permission denied for table users/);
 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/migrations/20261014113957_world_account_checks.sql',import.meta.url),'utf8'));
 await db.exec('set role service_role');
 const boot=await api('bootstrap');assert.equal(boot.catalog.length,24);
 const room=await api('create_room',{name:'Permission test'});
 const snapshot=(await db.query('select public.world_room_snapshot($1,$2) result',[users[0],room.roomId])).rows[0].result;
 assert.equal(snapshot.ownerId,users[0]);
 await assert.rejects(db.query('select encrypted_password from auth.users'),/permission denied/);
 await db.exec('reset role');
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[users[0]]);
 await db.exec('set role service_role');await assert.rejects(api('bootstrap'),/Account unavailable/);
 for(const role of ['anon','authenticated']) {
  await db.exec('reset role; set role '+role);
  await assert.rejects(api('bootstrap'),/permission denied/);
  await assert.rejects(db.query('select id from auth.users'),/permission denied/);
 }
 console.log('World account permissions: reproduced failure; bootstrap and own-room snapshot pass; secret columns, unconfirmed accounts, anon and authenticated access denied.');
} finally {await fixture.close();}
