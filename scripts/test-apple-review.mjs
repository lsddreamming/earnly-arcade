import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compile=async(file)=>import('data:text/javascript;base64,'+Buffer.from((await build({entryPoints:[file],bundle:true,write:false,format:'esm',platform:'node'})).outputFiles[0].text).toString('base64'));
const {appleReviewPolicy}=await compile('supabase/functions/_shared/apple-review-policy.ts');
const {appleCommerceHandler}=await compile('supabase/functions/_shared/apple-commerce.ts');
const {fulfillApplePass}=await compile('supabase/functions/_shared/pass-commerce.ts');
const uid='00000000-0000-4000-8000-000000000003';
const transaction={environment:'Sandbox',bundleId:'com.earnly.arcade',productId:'com.earnly.arcade.coins.starter',type:'Consumable',quantity:1,inAppOwnershipType:'PURCHASED',transactionId:'123',originalTransactionId:'123',appAccountToken:uid};
function policy({enrolled=true,production=false,patch={}}={}){
 let reads=0;
 const result=appleReviewPolicy({isTestAccount:async id=>enrolled&&id===uid,
 production:{verifyTransaction:async s=>{if(!production||s==='forged')throw Error();return {...transaction,environment:'Production'};},verifyNotification:async()=>{throw Error();}},
 sandboxVerifier:{verifyAndDecodeTransaction:async s=>{if(!['signed','current'].includes(s))throw Error('SIGNATURE');return {...transaction,...(s==='current'?patch:{})};},verifyAndDecodeNotification:async s=>{if(s!=='signed')throw Error('SIGNATURE');return {data:{environment:'Sandbox'}};}},
 sandboxClient:{getTransactionInfo:async()=>{reads++;return {signedTransactionInfo:'current'};}}});
 return {...result,reads:()=>reads};
}
test('sandbox requires both Apple verification and a server-enrolled test account',async()=>{
 const p=policy();assert.equal((await p.verifyTransaction('signed')).environment,'Sandbox');assert.equal(p.reads(),1);
 await assert.rejects(p.verifyTransaction('forged'));
 const denied=policy({enrolled:false});await assert.rejects(denied.verifyTransaction('signed'),/SANDBOX_TEST_ACCOUNT_REQUIRED/);assert.equal(denied.reads(),0);
 for(const patch of [{appAccountToken:'other'},{transactionId:'124'},{productId:'other'},{originalTransactionId:'124'},{environment:'Production'},{bundleId:'other'}])await assert.rejects(policy({patch}).verifyTransaction('signed'),/MISMATCH/);
});
test('test accounts cannot accept production purchases; regular production still works',async()=>{
 await assert.rejects(policy({production:true}).verifyTransaction('signed'),/PRODUCTION_ACCOUNT_REQUIRED/);
 assert.equal((await policy({production:true,enrolled:false}).verifyTransaction('signed')).environment,'Production');
});
test('sandbox notifications remain signed and revocation is monotonic',async()=>{
 const p=policy();await assert.rejects(p.verifyNotification('forged'));assert.equal((await p.verifyNotification('signed')).data.environment,'Sandbox');
 const revoked=policy({patch:{revocationDate:123}});assert.equal((await revoked.verifyTransaction('signed')).revocationDate,123);
});
test('sandbox coin route uses isolated receipts and never trusts client account or amount',async()=>{
 const writes=[];const p=policy();
 const handler=appleCommerceHandler({...p,db:{rpc:async(name,args)=>{writes.push({name,args});return {data:{transactionId:'123',status:'fulfilled'}};}},verifyUser:async()=>({id:uid})});
 const req=new Request('https://test/apple-coins/verify',{method:'POST',body:JSON.stringify({signedTransaction:'signed',coins:999999,userId:'attacker'})});
 assert.equal((await handler(req)).status,200);assert.equal(writes[0].name,'apple_sandbox_coin_fulfill');assert.equal(writes[0].args.p_user_id,uid);assert.equal(writes[0].args.p_environment,'Sandbox');assert.equal(writes[0].args.p_product_id,transaction.productId);
});
test('sandbox VIP keeps separate provider namespace and account binding',async()=>{
 let saved;const db={rpc:async(name,args)=>{saved={name,args};return {data:{active:true}};}};
 const t={...transaction,type:'Auto-Renewable Subscription',productId:'com.earnly.arcade.vip.monthly',expiresDate:Date.now()+60000,signedDate:Date.now()};
 await assert.rejects(fulfillApplePass(db,t,uid));assert.equal(saved,undefined);
 await assert.rejects(fulfillApplePass(db,t,'00000000-0000-4000-8000-000000000099',policy().allowSandboxTransaction));
 await fulfillApplePass(db,t,uid,policy().allowSandboxTransaction);assert.equal(saved.args.p_provider,'apple_sandbox');
});
