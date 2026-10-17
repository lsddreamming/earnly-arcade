import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
const built=await build({entryPoints:['supabase/functions/_shared/vip-furniture.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {appleFurnitureEvidence, stripeFurnitureEvidence}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const uid='00000000-0000-4000-8000-000000000001',now=Date.UTC(2026,9,17),end=now+30*86400000;
const apple={environment:'Production',bundleId:'com.earnly.arcade',productId:'com.earnly.arcade.vip.monthly',type:'Auto-Renewable Subscription',inAppOwnershipType:'PURCHASED',quantity:1,appAccountToken:uid,transactionId:'123',originalTransactionId:'100',price:4990,currency:'USD',purchaseDate:now,expiresDate:end};
test('paid Apple month has stable transaction and period identity across restore',()=>{
 const a=appleFurnitureEvidence(apple,uid,now);assert.equal(a.provider,'apple');assert.equal(a.periodEnd,new Date(end).toISOString());assert.deepEqual(appleFurnitureEvidence({...apple,signedDate:now+10000},uid,now),a);
});
test('Apple trials, missing price, sandbox, refunds, upgrades, future and short periods cannot award',()=>{
 for(const patch of [{price:0},{price:undefined},{currency:undefined},{environment:'Sandbox'},{revocationDate:now},{isUpgraded:true},{purchaseDate:now+1},{expiresDate:now+5*86400000},{expiresDate:now+365*86400000},{productId:'other'},{quantity:2},{inAppOwnershipType:'FAMILY_SHARED'}])assert.equal(appleFurnitureEvidence({...apple,...patch},uid,now),null,JSON.stringify(patch));
 assert.equal(appleFurnitureEvidence(apple,'00000000-0000-4000-8000-000000000002',now),null);
});
function stripe(){return {subscription:{id:'sub_1',customer:'cus_1',livemode:true,status:'active',metadata:{earnlyUser:uid,earnlyProduct:'vip',earnlyRequest:uid},items:{has_more:false,data:[{price:{id:'price_1'},quantity:1}]}},invoice:{id:'in_1',customer:'cus_1',livemode:true,status:'paid',currency:'usd',amount_paid:499,billing_reason:'subscription_cycle',parent:{subscription_details:{subscription:'sub_1'}},lines:{has_more:false,data:[{pricing:{price_details:{price:'price_1'}},quantity:1,amount:499,parent:{subscription_item_details:{proration:false}},period:{start:now/1000,end:end/1000}}]}}};}
test('verified Stripe monthly payment has stable award identity',()=>{const {invoice,subscription}=stripe();const a=stripeFurnitureEvidence(invoice,subscription,'price_1',499,false,now);assert.equal(a.provider,'stripe');assert.equal(a.transactionId,'in_1');assert.deepEqual(stripeFurnitureEvidence(invoice,subscription,'price_1',499,false,now+1000),a);});
test('Stripe missing paid evidence, refunds, sandbox, unpaid and proration invoices cannot award',()=>{
 for(const patch of [{livemode:false},{status:'open'},{amount_paid:0},{billing_reason:'subscription_update'},{customer:'wrong'}]){const f=stripe();Object.assign(f.invoice,patch);assert.equal(stripeFurnitureEvidence(f.invoice,f.subscription,'price_1',499,false,now),null);}
 for(const patch of [{quantity:2},{amount:0},{parent:{subscription_item_details:{proration:true}}},{period:{start:now/1000,end:(now+86400000)/1000}}]){const f=stripe();Object.assign(f.invoice.lines.data[0],patch);assert.equal(stripeFurnitureEvidence(f.invoice,f.subscription,'price_1',499,false,now),null);}
 const f=stripe();assert.equal(stripeFurnitureEvidence(f.invoice,f.subscription,'price_1',0,false,now),null);assert.equal(stripeFurnitureEvidence(f.invoice,f.subscription,'price_1',499,true,now),null);f.invoice.lines.has_more=true;assert.equal(stripeFurnitureEvidence(f.invoice,f.subscription,'price_1',499,false,now),null);
});
