import {PGlite} from '@electric-sql/pglite';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
for(const script of ['coin','apple','avatar'])execFileSync(process.execPath,['scripts/build-'+script+'-staging.mjs']);
const bundles=['coin','apple','avatar'].map(name=>JSON.parse(readFileSync('/tmp/earnly-'+name+'-staging.json')));
const db=new PGlite();
try {
 await db.exec('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 for(const bundle of bundles){assert.equal(bundle.project,'wphqfogbnpdsfkquvdsu');await db.exec(bundle.sql);}
 const uid='00000000-0000-4000-8000-000000000001';
 await db.query('INSERT INTO auth.users VALUES ($1)',[uid]);
 await db.query("INSERT INTO profiles VALUES ($1,'SandboxPlayer')",[uid]);
 await db.query('INSERT INTO coin_wallets(user_id) VALUES ($1)',[uid]);
 await db.query("SELECT apple_coin_fulfill($1,'100000000000001','com.earnly.arcade.coins.starter','Sandbox',false)",[uid]);
 await db.query("SELECT cosmetic_buy($1,'neon-jacket','11111111-1111-4111-8111-111111111111')",[uid]);
 await db.query("SELECT coin_play_action($1,'snake','22222222-2222-4222-8222-222222222222','buy')",[uid]);
 const wallet=(await db.query('SELECT balance,purchased_balance,lifetime_earned FROM coin_wallets WHERE user_id=$1',[uid])).rows[0];
 assert.equal(wallet.balance,175);assert.equal(wallet.purchased_balance,175);assert.equal(wallet.lifetime_earned,0);
 await db.exec('SET ROLE authenticated');
 await assert.rejects(db.query('SELECT * FROM cosmetic_inventory'),/permission denied/);
 await assert.rejects(db.query('SELECT cosmetic_me($1)',[uid]),/permission denied/);
 console.log('PASS: sandbox Apple coins buy avatars and plays; purchased provenance and access restrictions persist.');
} finally {await db.close();}
