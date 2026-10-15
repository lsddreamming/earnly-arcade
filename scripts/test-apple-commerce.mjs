import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {build} from 'esbuild';
const built=await build({entryPoints:['supabase/functions/_shared/apple-commerce.ts'],bundle:true,write:false,format:'esm',platform:'node'});const code=built.outputFiles[0].text;
const {appleCommerceHandler}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const uid='00000000-0000-4000-8000-000000000001';
function fixture(overrides={}){
 const calls=[];const transaction={environment:'Production',bundleId:'com.earnly.arcade',type:'Consumable',quantity:1,inAppOwnershipType:'PURCHASED',transactionId:'123',appAccountToken:uid,productId:'com.earnly.arcade.coins.starter',...overrides};
 const handler=appleCommerceHandler({enabled:true,db:{rpc:async(name,args)=>{calls.push({name,args});return {data:{status:'fulfilled',transactionId:'123'}};}},verifyUser:async token=>token==='valid'?{id:uid}:null,verifyTransaction:async signed=>{if(signed==='forged')throw Error();return transaction;},verifyNotification:async signed=>{if(signed!=='signed')throw Error();return {data:{signedTransactionInfo:'verified'}};}});
 const request=(path='/verify',body={signedTransaction:'verified'},auth='valid')=>handler(new Request('https://test/apple-coins'+path,{method:'POST',headers:{Origin:'capacitor://localhost',Authorization:'Bearer '+auth},body:JSON.stringify(body)}));
 return {calls,request};
}
test('auth, signed verification and exact transaction eligibility protect minting',async()=>{
 for(const overrides of [{environment:'Sandbox'},{bundleId:'other'},{type:'Non-Consumable'},{quantity:2},{inAppOwnershipType:'FAMILY_SHARED'},{productId:'fake'},{appAccountToken:'00000000-0000-4000-8000-000000000002'},{transactionId:'x'}]){
 const f=fixture(overrides);assert.ok((await f.request()).status>=400);assert.equal(f.calls.length,0);
 }
 for(const [signed,auth] of [['forged','valid'],['verified','forged']]){const f=fixture();assert.ok((await f.request('/verify',{signedTransaction:signed},auth)).status>=400);assert.equal(f.calls.length,0);}
});
test('verified purchase ignores client-supplied coin counts and user IDs',async()=>{const f=fixture();assert.equal((await f.request('/verify',{signedTransaction:'verified',coins:999999,userId:'attacker'})).status,200);assert.deepEqual(f.calls[0].args,{p_user_id:uid,p_transaction_id:'123',p_product_id:'com.earnly.arcade.coins.starter',p_environment:'Production',p_revoked:false});});
test('signed refund notifications revoke through the same atomic ledger',async()=>{const f=fixture({revocationDate:123});assert.equal((await f.request('/notifications',{signedPayload:'signed'})).status,200);assert.equal(f.calls[0].args.p_revoked,true);const bad=fixture();assert.equal((await bad.request('/notifications',{signedPayload:'forged'})).status,503);assert.equal(bad.calls.length,0);});

test('failure diagnostics identify only safe stages and allowlisted reasons',async()=>{
 const logs=[];const warn=console.warn;console.warn=(...args)=>logs.push(args);
 try {
  for(const message of ['SANDBOX_TEST_ACCOUNT_REQUIRED','private receipt and account data']){
   const handler=appleCommerceHandler({verifyUser:async()=>({id:uid}),verifyTransaction:async()=>{throw new Error(message);}});
   const response=await handler(new Request('https://test/apple-coins/verify',{method:'POST',body:JSON.stringify({signedTransaction:'private signed receipt'})}));
   assert.equal(response.status,message==='SANDBOX_TEST_ACCOUNT_REQUIRED'?403:503);
   const body=await response.json();
   if(message==='SANDBOX_TEST_ACCOUNT_REQUIRED'){assert.equal(body.error.code,message);assert.match(body.error.message,/reopening the shop will not change/);}
  }
  const first=JSON.parse(logs[0][1]);assert.equal(first.stage,'verification');assert.equal(first.reason,'SANDBOX_TEST_ACCOUNT_REQUIRED');
  assert.equal(JSON.parse(logs[1][1]).reason,'UNCLASSIFIED');
  assert.ok(!JSON.stringify(logs).includes('private'));
 }finally{console.warn=warn;}
});
