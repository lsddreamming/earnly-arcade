import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import Stripe from 'stripe';
execFileSync(process.execPath,['scripts/build-shop-staging.mjs']);
const bundle=JSON.parse(readFileSync('/tmp/earnly-shop-staging.json','utf8'));
const files=bundle.functions.find(f=>f.name==='arcade-pass').files;
const runtime=files.find(f=>f.name==='arcade-pass/index.ts').content;
const source=files.find(f=>f.name==='_shared/pass-commerce.ts').content;
const built=await build({stdin:{contents:source,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const {passHandler}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
// Local fixture only; not a provider credential or deployed signing secret.
const secret='whsec_local_automated_fixture';
const stripeSDK=new Stripe('sk_test_local_automated_fixture');
const uid='00000000-0000-4000-8000-000000000001';
const requestId='22222222-2222-4222-8222-222222222222';
const priceId='price_1UPqV8DiPv1t7Me2icvDqvHT';
function fixture(){
 const row={user_id:uid,request_id:requestId,customer_id:'cus_test'};
 const line={pricing:{price_details:{price:priceId}},period:{end:Math.floor(Date.now()/1000)+86400}};
 const invoice={id:'in_test',livemode:false,parent:{subscription_details:{subscription:'sub_test'}},status:'paid',currency:'usd',amount_paid:499,lines:{has_more:false,data:[line]}};
 const sub={id:'sub_test',livemode:false,status:'active',customer:'cus_test',latest_invoice:invoice.id,metadata:{earnlyUser:uid,earnlyProduct:'vip',earnlyRequest:requestId},items:{has_more:false,data:[{price:{id:priceId},quantity:1}]}};
 const payment={livemode:false,payment:{type:'payment_intent',payment_intent:'pi_test'},amount_paid:499,invoice:invoice.id};
 const intent={livemode:false,status:'succeeded',customer:'cus_test',currency:'usd',latest_charge:{amount_refunded:0,disputed:false}};
 const ledger=new Map();let calls=0,fail=false;
 const db={rpc:async(name,args)=>{calls++;if(fail){fail=false;return {error:Error('transient')};}assert.equal(name,'arcade_pass_record');const old=ledger.get(args.p_transaction_id);ledger.set(args.p_transaction_id,{...args,p_revoked:!!old?.p_revoked||args.p_revoked});return {data:{active:!args.p_revoked}};},from(table){let update;return {select(){return this;},eq(){return this;},update(value){update=value;return this;},maybeSingle:async()=>({data:row}),then(resolve){if(table==='arcade_pass_transactions'&&update?.revoked)for(const old of ledger.values())old.p_revoked=true;resolve({data:row});}};}};
 const stripe={invoices:{retrieve:async()=>invoice},subscriptions:{retrieve:async()=>sub},invoicePayments:{list:async()=>({has_more:false,data:[payment]})},paymentIntents:{retrieve:async()=>intent},checkout:{sessions:{retrieve:async()=>({livemode:false,mode:'subscription',subscription:sub.id})}}};
 const handler=passHandler({db,stripe,stripeLive:false,priceId,verifyUser:async()=>null,verifyEvent:(raw,sig)=>stripeSDK.webhooks.constructEventAsync(raw,sig,secret,300,Stripe.createSubtleCryptoProvider())});
 async function send(type='invoice.paid',options={}){
  const payload=JSON.stringify({id:'evt_fixture',type,livemode:false,created:Math.floor(Date.now()/1000),data:{object:{id:invoice.id,payment_intent:'pi_test'}},...options.event});
  let signature=stripeSDK.webhooks.generateTestHeaderString({payload,secret,timestamp:options.timestamp||Math.floor(Date.now()/1000)});
  if(options.bad)signature+='corrupt';
  return handler(new Request('https://test/arcade-pass/stripe/webhook',{method:'POST',headers:options.unsigned?{}:{'stripe-signature':signature},body:options.tamper?payload+' ':payload}));
 }
 return {send,ledger,invoice,sub,payment,intent,handler,get calls(){return calls;},failNext(){fail=true;}};
}
test('sandbox bundle pins testing project and rejects live keys',()=>{
 assert.equal(bundle.project,'wphqfogbnpdsfkquvdsu');assert.match(runtime,/_test_/);assert.doesNotMatch(runtime,/_live_/);assert.match(runtime,/stripeLive:false/);
 assert(files.some(f=>f.content.includes("if(Deno.env.get('SUPABASE_URL')!=='https://wphqfogbnpdsfkquvdsu.supabase.co')throw")));
});
test('signed Sandbox invoice grants exactly one cosmetic period across duplicate deliveries',async()=>{const f=fixture();assert.equal((await f.send()).status,200);assert.equal((await f.send()).status,200);assert.equal(f.ledger.size,1);assert.equal([...f.ledger.values()][0].p_revoked,false);});
test('missing, forged, stale and changed-body signatures cannot write',async()=>{for(const options of [{unsigned:true},{bad:true},{timestamp:Math.floor(Date.now()/1000)-600},{tamper:true}]){const f=fixture();assert.equal((await f.send('invoice.paid',options)).status,400);assert.equal(f.calls,0);}});
test('live events and mixed-environment provider objects cannot grant in Sandbox',async()=>{const f=fixture();await f.send('invoice.paid',{event:{livemode:true}});assert.equal(f.calls,0);for(const field of ['invoice','sub','payment','intent']){const g=fixture();g[field].livemode=true;await g.send();assert.equal(g.calls,0);}});
test('missing mode is rejected rather than treated as Sandbox',async()=>{const f=fixture();delete f.invoice.livemode;await f.send();assert.equal(f.calls,0);});
test('checkout completion reconciles provider payment, not its redirect',async()=>{const f=fixture();assert.equal((await f.send('checkout.session.completed')).status,200);assert.equal(f.ledger.size,1);const g=fixture();g.invoice.status='open';g.invoice.amount_paid=0;await g.send('checkout.session.completed');assert.equal(g.ledger.size,0);});
test('end-of-period cancellation preserves paid period; immediate cancellation revokes it',async()=>{const f=fixture();f.sub.cancel_at_period_end=true;await f.send('customer.subscription.updated');assert.equal([...f.ledger.values()][0].p_revoked,false);f.sub.status='canceled';await f.send('customer.subscription.deleted');assert.equal([...f.ledger.values()][0].p_revoked,true);await f.send();assert.equal([...f.ledger.values()][0].p_revoked,true);});
test('late older invoice cannot revive a canceled subscription',async()=>{const f=fixture();await f.send();f.sub.status='canceled';f.invoice.id='in_older';await f.send();assert.equal(f.ledger.size,2);assert([...f.ledger.values()].every(r=>r.p_revoked));});
test('failed renewal grants no new period and preserves already paid expiry',async()=>{const f=fixture();await f.send();f.sub.status='past_due';f.invoice.id='in_renewal';f.invoice.status='open';f.invoice.amount_paid=0;await f.send('invoice.payment_failed');assert.equal(f.ledger.size,1);assert.equal([...f.ledger.values()][0].p_revoked,false);});
test('successful renewal creates one new verified period',async()=>{const f=fixture();await f.send();f.invoice.id='in_renewal';await f.send();await f.send();assert.equal(f.ledger.size,2);});
test('refund and dispute revoke and replay never restores the period',async()=>{for(const type of ['charge.refunded','charge.dispute.created']){const f=fixture();await f.send();await f.send(type);await f.send();assert.equal([...f.ledger.values()][0].p_revoked,true);}});
test('voided invoice cannot retain previously granted benefits',async()=>{const f=fixture();await f.send();f.invoice.status='void';await f.send('invoice.voided');assert.equal([...f.ledger.values()][0].p_revoked,true);});
test('paused and incomplete subscriptions cannot grant',async()=>{for(const status of ['paused','incomplete','trialing']){const f=fixture();f.sub.status=status;await f.send();assert.equal(f.calls,0);}});
test('provider metadata mismatch and truncated invoice never grant',async()=>{for(const change of [f=>f.sub.customer='cus_wrong',f=>f.sub.items.data[0].price.id='price_wrong',f=>f.invoice.lines.has_more=true]){const f=fixture();change(f);assert.equal((await f.send()).status,503);assert.equal(f.calls,0);}});
test('database failure returns retryable failure and retry succeeds once',async()=>{const f=fixture();f.failNext();assert.equal((await f.send()).status,503);assert.equal(f.ledger.size,0);assert.equal((await f.send()).status,200);assert.equal(f.ledger.size,1);});
test('unsupported events acknowledge without granting and Sandbox checkout defaults closed',async()=>{const f=fixture();assert.equal((await f.send('customer.created')).status,200);assert.equal(f.calls,0);const health=await(await f.handler(new Request('https://test/arcade-pass/health'))).json();assert.equal(health.mode,'sandbox');assert.equal(health.webAvailable,false);assert.equal(health.appleAvailable,false);});
