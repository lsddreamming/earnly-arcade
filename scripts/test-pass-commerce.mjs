import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
const built=await build({entryPoints:['supabase/functions/_shared/pass-commerce.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {fulfillApplePass,passHandler}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const uid='00000000-0000-4000-8000-000000000001';
const transaction={environment:'Production',bundleId:'com.earnly.arcade',productId:'com.earnly.arcade.vip.monthly',type:'Auto-Renewable Subscription',inAppOwnershipType:'PURCHASED',quantity:1,appAccountToken:uid,transactionId:'123',originalTransactionId:'100',expiresDate:Date.now()+86400000,signedDate:Date.now()};
test('Apple pass rejects wrong environment, product, account, ownership and malformed dates',async()=>{let calls=0;const db={rpc:async()=>{calls++;return {data:{active:true}};}};for(const patch of [{environment:'Sandbox'},{productId:'other'},{type:'Consumable'},{quantity:2},{inAppOwnershipType:'FAMILY_SHARED'},{expiresDate:'tomorrow'},{appAccountToken:'fake'},{transactionId:'not-numeric'},{bundleId:'other'}])await assert.rejects(fulfillApplePass(db,{...transaction,...patch},uid));await assert.rejects(fulfillApplePass(db,transaction,'00000000-0000-4000-8000-000000000002'));assert.equal(calls,0);});
test('Apple pass records verified expiry and revocation without crediting coins',async()=>{let call;const db={rpc:async(name,args)=>{call={name,args};return {data:{active:false}};}};await fulfillApplePass(db,{...transaction,revocationDate:Date.now()},uid);assert.equal(call.name,'arcade_pass_record');assert.equal(call.args.p_revoked,true);assert.equal(call.args.p_expires_at,new Date(transaction.expiresDate).toISOString());assert.equal(call.args.p_user_id,uid);});
test('Pass API rejects unsigned webhooks and unauthorized mutations; switches default closed',async()=>{let writes=0;const handler=passHandler({db:{rpc:async()=>{writes++;return {data:true};}},verifyUser:async()=>null,stripe:{},verifyEvent:async()=>{throw Error('bad signature');}});const request=(path,body)=>handler(new Request('https://test/arcade-pass'+path,{method:body?'POST':'GET',body:body?JSON.stringify(body):undefined}));assert.deepEqual(await(await request('/config')).json(),{webAvailable:false,appleAvailable:false,productId:'com.earnly.arcade.vip.monthly'});assert.equal((await request('/stripe/webhook',{})).status,400);assert.equal((await request('/apple/verify',{})).status,401);assert.equal(writes,0);});
function stripeFixture({live=true,paid=true,refunded=false,signature=true,owner=uid,amount=499}={}){
 const calls=[];const row={user_id:uid,customer_id:'cus_1',request_id:'22222222-2222-4222-8222-222222222222'};
 const invoice={id:'in_1',parent:{subscription_details:{subscription:'sub_1'}},livemode:live,status:paid?'paid':'open',currency:'usd',amount_paid:amount,lines:{data:[{pricing:{price_details:{price:'price_vip'}},period:{end:Math.floor(Date.now()/1000)+86400}}]}};
 const sub={id:'sub_1',customer:'cus_1',livemode:live,metadata:{earnlyUser:owner,earnlyProduct:'vip',earnlyRequest:row.request_id},items:{data:[{price:{id:'price_vip'},quantity:1}]}};
 const stripe={invoices:{retrieve:async()=>invoice},subscriptions:{retrieve:async()=>sub},invoicePayments:{list:async()=>({has_more:false,data:[{livemode:live,payment:{type:'payment_intent',payment_intent:'pi_1'},amount_paid:amount,invoice:'in_1'}]})},paymentIntents:{retrieve:async()=>({status:'succeeded',customer:'cus_1',currency:'usd',livemode:live,latest_charge:{amount_refunded:refunded?499:0,disputed:false}})}};
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{active:true}};},from(){return {select(){return this;},eq(){return this;},update(){return this;},maybeSingle:async()=>({data:row}),then(resolve){resolve({data:row});}};}};
 const handler=passHandler({db,stripe,verifyUser:async()=>({id:uid}),verifyEvent:async raw=>{if(!signature)throw Error();return JSON.parse(raw);},priceId:'price_vip'});
 const send=(type='invoice.paid')=>handler(new Request('https://test/arcade-pass/stripe/webhook',{method:'POST',body:JSON.stringify({type,livemode:live,data:{object:{id:'in_1',payment_intent:'pi_1'}}})}));return {send,calls,sub};
}
test('Stripe verified paid invoice grants cosmetic expiry only; refunds revoke',async()=>{const f=stripeFixture();assert.equal((await f.send()).status,200);assert.equal(f.calls[0].name,'arcade_pass_record');assert.equal(f.calls[0].args.p_revoked,false);const refund=stripeFixture({refunded:true});await refund.send('charge.refunded');assert.equal(refund.calls[0].args.p_revoked,true);});
test('Stripe test mode, unpaid invoices, low amount, invalid signatures and mismatched metadata never grant',async()=>{for(const opts of [{live:false},{paid:false},{amount:1},{signature:false},{owner:'attacker'}]){const f=stripeFixture(opts);await f.send();assert.equal(f.calls.length,0);}});
test('Stripe wrong price never reaches entitlement ledger',async()=>{const f=stripeFixture();f.sub.items.data[0].price.id='cheap';assert.equal((await f.send()).status,503);assert.equal(f.calls.length,0);});

test('Refunds for an older subscription survive a later checkout generation',async()=>{const f=stripeFixture({refunded:true});f.sub.metadata.earnlyRequest='33333333-3333-4333-8333-333333333333';assert.equal((await f.send('charge.refunded')).status,200);assert.equal(f.calls[0].args.p_revoked,true);});
test('Malformed checkout provenance cannot grant a pass',async()=>{const f=stripeFixture();f.sub.metadata.earnlyRequest='forged';assert.equal((await f.send()).status,503);assert.equal(f.calls.length,0);});

test('release hold overrides provider flags and blocks checkout before any provider or ledger call',async()=>{
 for(const paymentsVerified of [undefined,false,'true',1]){
  let calls=0;
  const handler=passHandler({paymentsVerified,webEnabled:true,appleEnabled:true,priceId:'price_vip',
   stripe:{prices:{retrieve:async()=>{calls++;throw Error('must not call Stripe');}}},
   db:{rpc:async()=>{calls++;throw Error('must not write');}},
   verifyUser:async()=>({id:uid}),verifyEvent:async()=>({}),verifyTransaction:async()=>transaction});
  const config=await(await handler(new Request('https://test/arcade-pass/config'))).json();
  assert.equal(config.webAvailable,false);assert.equal(config.appleAvailable,false);
  const response=await handler(new Request('https://test/arcade-pass/checkout',{method:'POST',body:'{}',headers:{'idempotency-key':uid}}));
  assert.equal(response.status,503);assert.equal(calls,0);
 }
});

test('verified release still requires each provider switch and its dependencies',async()=>{
 const ready={paymentsVerified:true,webEnabled:true,appleEnabled:true,stripe:{},priceId:'price_vip',verifyEvent:async()=>({}),verifyTransaction:async()=>transaction};
 for(const [patch,web,apple] of [[{},true,true],[{webEnabled:false},false,true],[{appleEnabled:false},true,false],
  [{stripe:null},false,true],[{priceId:''},false,true],[{verifyEvent:null},false,true],[{verifyTransaction:null},true,false]]){
  const handler=passHandler({...ready,...patch});
  const config=await(await handler(new Request('https://test/arcade-pass/config'))).json();
  assert.equal(config.webAvailable,web);assert.equal(config.appleAvailable,apple);
 }
});

test('release hold preserves Apple restore and website subscription management',async()=>{
 const calls=[];
 const db={rpc:async(name,args)=>{calls.push(name);return {data:{active:true}};},from(){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{customer_id:'cus_existing'}})};}};
 const handler=passHandler({db,paymentsVerified:false,verifyUser:async()=>({id:uid}),verifyTransaction:async()=>transaction,
  stripe:{billingPortal:{sessions:{create:async options=>{assert.equal(options.customer,'cus_existing');calls.push('portal');return {url:'https://billing.stripe.com/session/test'};}}}}});
 for(const path of ['/apple/verify','/portal']){
  const response=await handler(new Request('https://test/arcade-pass'+path,{method:'POST',body:JSON.stringify({signedTransaction:'verified-by-test-adapter'})}));
  assert.equal(response.status,200);
 }
 assert.deepEqual(calls,['arcade_pass_record','portal']);
});
