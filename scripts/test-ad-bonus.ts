import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyReceipt} from '../supabase/functions/ad-bonus/verify.ts';
import {handleAdBonus} from '../supabase/functions/ad-bonus/handler.ts';
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const keys=[{keyId:7,pem:publicKey.export({type:'spki',format:'pem'})}];
const ticket='12345678-1234-4234-8234-123456789abc';
function url(extra={}){const p=new URLSearchParams({ad_unit:'1831908609',custom_data:ticket,timestamp:String(Date.now()),transaction_id:'receipt-1',...extra});const data=p.toString();return 'https://example.test/?'+data+'&signature='+sign('sha256',Buffer.from(decodeURIComponent(data.replace(/\+/g,' '))),privateKey).toString('base64url')+'&key_id=7';}
test('signed Google-format callback verifies signed query values',()=>{assert.equal(verifyReceipt(url(),keys).ticket,ticket);});
test('tampering, stale receipts, wrong unit, unknown key and duplicate fields fail',()=>{
 for(const bad of [url().replace('receipt-1','receipt-2'),url({timestamp:'1'}),url({ad_unit:'999'}),url().replace('key_id=7','key_id=8'),url().replace('&signature','&transaction_id=other&signature')])assert.throws(()=>verifyReceipt(bad,keys));
});
test('unsigned callbacks cannot touch the database',async()=>{let calls=0;const res=await handleAdBonus(new Request('https://example.test/?custom_data='+ticket),{rpc:()=>{calls++;}},async()=>keys);assert.equal(res.status,400);assert.equal(calls,0);});
test('verified callbacks use only signed values and retry database errors',async()=>{let args;const db={rpc:async(name,value)=>{assert.equal(name,'ad_bonus_complete');args=value;return {error:null};}};assert.equal((await handleAdBonus(new Request(url()),db,async()=>keys)).status,200);assert.equal(args.p_ticket,ticket);assert.equal((await handleAdBonus(new Request(url()),{rpc:async()=>({error:{}})},async()=>keys)).status,503);});
test('client identity comes from authenticated session, not request body',async()=>{let args;const db={auth:{getUser:async()=>({data:{user:{id:'real-user',email_confirmed_at:'today'}}})},rpc:async(name,value)=>{args=value;return {data:{watched:0}};}};const req=new Request('https://example.test/',{method:'POST',headers:{authorization:'Bearer token'},body:JSON.stringify({action:'ticket',placement:'bonusCoins',user_id:'victim'})});assert.equal((await handleAdBonus(req,db)).status,200);assert.equal(args.p_actor,'real-user');});
test('anonymous and missing sessions cannot obtain tickets',async()=>{for(const user of [null,{id:'anon',is_anonymous:true},{id:'unconfirmed'}]){const db={auth:{getUser:async()=>({data:{user}})},rpc:()=>assert.fail('must not call RPC')};const req=new Request('https://example.test/',{method:'POST',headers:{authorization:'Bearer token'},body:'{"action":"ticket"}'});assert.equal((await handleAdBonus(req,db)).status,401);}});

test('percent-escaped content matches Google reference verifier',()=>{assert.equal(verifyReceipt(url({reward_item:'Arcade Coins & furniture'}),keys).ticket,ticket);});
test('signed dashboard probe never reaches the coin ledger',async()=>{const probe=url({ad_unit:'1234567890',custom_data:'00000000-0000-4000-8000-000000000000',transaction_id:'123456789'});const res=await handleAdBonus(new Request(probe),{rpc:()=>assert.fail('probe cannot reward')},async()=>keys);assert.equal(res.status,200);assert.equal((await res.json()).test,true);});

test('actual Google dashboard signature verifies form-encoded spaces',async()=>{
 const {readFile}=await import('node:fs/promises');
 const fixture=JSON.parse(await readFile(new URL('../tests/admob-probe-fixture.json',import.meta.url),'utf8'));
 const receipt=verifyReceipt(fixture.url,fixture.keys,1792592031221);
 assert.equal(receipt.test,true);
});
