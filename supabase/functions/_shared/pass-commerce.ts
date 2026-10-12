export const passProduct='com.earnly.arcade.vip.monthly';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unwrap=(result:any)=>{if(result.error)throw result.error;return result.data;};
export async function fulfillApplePass(db:any,t:any,userId?:string){
 if(t.environment!=='Production'||t.bundleId!=='com.earnly.arcade'||t.productId!==passProduct||t.type!=='Auto-Renewable Subscription'||t.inAppOwnershipType!=='PURCHASED'||t.quantity!==1||!uuid.test(t.appAccountToken||'')||!/^\d{1,32}$/.test(t.transactionId||'')||!/^\d{1,32}$/.test(t.originalTransactionId||'')||!Number.isSafeInteger(t.expiresDate)||!Number.isSafeInteger(t.signedDate))throw new Error('INVALID_TRANSACTION');
 if(userId&&userId.toLowerCase()!==t.appAccountToken.toLowerCase())throw new Error('TRANSACTION_OWNER_MISMATCH');
 const state=unwrap(await db.rpc('arcade_pass_record',{p_user_id:t.appAccountToken,p_provider:'apple',p_transaction_id:t.transactionId,p_subscription_id:t.originalTransactionId,p_expires_at:new Date(t.expiresDate).toISOString(),p_revoked:t.revocationDate!=null,p_observed_at:new Date(t.signedDate).toISOString()}));
 return {...state,transactionId:t.transactionId};
}
export function passHandler({db,stripe,verifyUser,verifyEvent,verifyTransaction,webEnabled=false,appleEnabled=false,paymentsVerified=false,priceId}:any){
 // The release hold controls new sales only. Keep signed reconciliation, refunds,
 // restore and cancellation available even when an operator disables checkout.
 webEnabled=paymentsVerified===true&&webEnabled===true&&!!stripe&&!!verifyEvent&&!!priceId;
 appleEnabled=paymentsVerified===true&&appleEnabled===true&&!!verifyTransaction;
 const getRow=async(id:string)=>unwrap(await db.from('arcade_pass_checkout').select('*').eq('user_id',id).maybeSingle());
 async function reconcileInvoice(invoiceId:string,forceRevoke=false){
  const invoice=await stripe.invoices.retrieve(invoiceId);
  const subscriptionId=invoice.parent?.subscription_details?.subscription;
  if(typeof subscriptionId!=='string'||!invoice.livemode)return;
  const sub=await stripe.subscriptions.retrieve(subscriptionId);
  const uid=sub.metadata?.earnlyUser;
  if(!uuid.test(uid||'')||sub.metadata?.earnlyProduct!=='vip'||!sub.livemode)return;
  if(sub.items.data.length!==1||sub.items.data[0].price.id!==priceId||sub.items.data[0].quantity!==1)throw new Error('PAYMENT_MISMATCH');
  const row=await getRow(uid);if(!row||row.customer_id!==sub.customer||!uuid.test(sub.metadata?.earnlyRequest||''))throw new Error('PAYMENT_MISMATCH');
  // Never grant on a success URL or invoice marked paid out of band.
  const payments=await stripe.invoicePayments.list({invoice:invoice.id,status:'paid',limit:100});
  if(payments.has_more)throw new Error('PAYMENT_REVIEW');
  let paid=0,revoked=forceRevoke;
  for(const p of payments.data){
   if(!p.livemode||p.payment?.type!=='payment_intent')continue;
   const intent=await stripe.paymentIntents.retrieve(p.payment.payment_intent,{expand:['latest_charge']});
   const charge=intent.latest_charge;
   if(intent.status!=='succeeded'||intent.customer!==sub.customer||intent.currency!=='usd'||!intent.livemode||!charge||typeof charge==='string')continue;
   paid+=p.amount_paid;revoked||=charge.amount_refunded>0||charge.disputed;
  }
  if(!revoked&&(invoice.status!=='paid'||invoice.currency!=='usd'||invoice.amount_paid<499||paid<invoice.amount_paid))return;
  const line=invoice.lines.data.find((l:any)=>l.pricing?.price_details?.price===priceId);
  if(!line||!Number.isSafeInteger(line.period?.end))throw new Error('PAYMENT_MISMATCH');
  unwrap(await db.rpc('arcade_pass_record',{p_user_id:uid,p_provider:'stripe',p_transaction_id:invoice.id,p_subscription_id:sub.id,p_expires_at:new Date(line.period.end*1000).toISOString(),p_revoked:revoked,p_observed_at:new Date().toISOString()}));
  unwrap(await db.from('arcade_pass_checkout').update({subscription_id:sub.id}).eq('user_id',uid));
 }
 return async(req:Request)=>{
  const path=new URL(req.url).pathname.split('/arcade-pass')[1]||'/',origin=req.headers.get('origin');
  const origins=['https://earnlyarcade.com','https://www.earnlyarcade.com','capacitor://localhost'];
  const headers:any={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,content-type,idempotency-key,apikey,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  if(origin&&origins.includes(origin))headers['Access-Control-Allow-Origin']=origin;
  const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
  const fail=(message:string,status=400)=>json({error:{message}},status);
  if(origin&&!origins.includes(origin))return fail('Origin denied.',403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(path==='/config'&&req.method==='GET')return json({webAvailable:!!webEnabled,appleAvailable:!!appleEnabled,productId:passProduct});
  try{
   if(path==='/stripe/webhook'&&req.method==='POST'){
    if(!verifyEvent||!stripe)return fail('Not configured.',503);
    const raw=await req.text();if(raw.length>262144)return fail('Request too large.',413);
    let event;try{event=await verifyEvent(raw,req.headers.get('stripe-signature')||'');}catch{return fail('Invalid signature.');}
    if(!event.livemode)return json({received:true});
    const object=event.data.object;
    if(event.type.startsWith('invoice.'))await reconcileInvoice(object.id);
    else if(event.type.startsWith('customer.subscription.')){
     const sub=await stripe.subscriptions.retrieve(object.id);if(sub.latest_invoice)await reconcileInvoice(typeof sub.latest_invoice==='string'?sub.latest_invoice:sub.latest_invoice.id);
    }else if(['charge.refunded','charge.dispute.created','charge.dispute.closed'].includes(event.type)){
     const intent=typeof object.payment_intent==='string'?object.payment_intent:object.payment_intent?.id;
     if(intent){const payments=await stripe.invoicePayments.list({payment:{type:'payment_intent',payment_intent:intent},limit:100});if(payments.has_more)throw new Error('PAYMENT_REVIEW');for(const p of payments.data)await reconcileInvoice(typeof p.invoice==='string'?p.invoice:p.invoice.id,event.type==='charge.refunded'||event.type==='charge.dispute.created');}
    }
    return json({received:true});
   }
   const user=await verifyUser(req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]||'');
   if(!user||user.is_anonymous)return fail('Sign in to manage your pass.',401);
   if(path==='/me'&&req.method==='GET'){
    const row=await getRow(user.id);
    if(stripe&&row?.session_id){const session=await stripe.checkout.sessions.retrieve(row.session_id);if(session.subscription){const sub=await stripe.subscriptions.retrieve(session.subscription);if(sub.latest_invoice)await reconcileInvoice(typeof sub.latest_invoice==='string'?sub.latest_invoice:sub.latest_invoice.id);}}
    const active=unwrap(await db.rpc('arcade_pass_active',{p_user_id:user.id}));
    const transactions=unwrap(await db.from('arcade_pass_transactions').select('provider,expires_at').eq('user_id',user.id).order('expires_at',{ascending:false}).limit(1));
    return json({active,provider:transactions?.[0]?.provider||null,expiresAt:transactions?.[0]?.expires_at||null});
   }
   if(req.method!=='POST')return fail('Route not found.',404);
   const raw=await req.text();if(raw.length>65536)return fail('Request too large.',413);let body;try{body=JSON.parse(raw);}catch{return fail('Invalid JSON.');}
   if(path==='/apple/verify'){
    if(!verifyTransaction)return fail('Apple verification not configured.',503);
    if(typeof body.signedTransaction!=='string')return fail('Signed transaction required.');
    return json(await fulfillApplePass(db,await verifyTransaction(body.signedTransaction),user.id));
   }
   if(origin==='capacitor://localhost')return fail('Use Apple subscription management on iPhone.',403);
   if(path==='/portal'){
    const row=await getRow(user.id);if(!stripe||!row?.customer_id)return fail('No website subscription found.',404);
    return json(await stripe.billingPortal.sessions.create({customer:row.customer_id,return_url:'https://earnlyarcade.com/avatars.html#vip-pass'}));
   }
   if(path==='/checkout'){
    if(!webEnabled||!stripe||!priceId)return fail('Subscriptions are coming soon.',503);
    const key=req.headers.get('idempotency-key');if(!key||!uuid.test(key))return fail('Request ID required.');
    const price=await stripe.prices.retrieve(priceId);
    if(!price.active||!price.livemode||price.unit_amount!==499||price.currency!=='usd'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1)throw new Error('PRICE_NOT_VERIFIED');
    let row=unwrap(await db.rpc('arcade_pass_reserve',{p_user_id:user.id,p_request_id:key}));
    let session;if(row.session_id){session=await stripe.checkout.sessions.retrieve(row.session_id);
     if(session.status!=='open'){
      if(session.subscription){const sub=await stripe.subscriptions.retrieve(session.subscription);if(!['canceled','incomplete_expired'].includes(sub.status))return fail('An existing subscription needs attention. Restore or manage it before subscribing again.',409);}
      // CAS reset: concurrent retries cannot create a second checkout generation.
      unwrap(await db.from('arcade_pass_checkout').update({request_id:crypto.randomUUID(),session_id:null,subscription_id:null}).eq('user_id',user.id).eq('request_id',row.request_id));
      row=await getRow(user.id);session=null;
     }
    }
    if(!session){
     const customer=row.customer_id|| (await stripe.customers.create({metadata:{earnlyUser:user.id}},{idempotencyKey:'earnly-vip-customer-'+row.request_id})).id;
     unwrap(await db.from('arcade_pass_checkout').update({customer_id:customer}).eq('user_id',user.id));
     session=await stripe.checkout.sessions.create({mode:'subscription',customer,line_items:[{price:priceId,quantity:1}],subscription_data:{metadata:{earnlyUser:user.id,earnlyProduct:'vip',earnlyRequest:row.request_id}},success_url:'https://earnlyarcade.com/avatars.html#vip-pass',cancel_url:'https://earnlyarcade.com/avatars.html#vip-pass'}, {idempotencyKey:'earnly-vip-'+row.request_id});
     if(!session.livemode)throw new Error('MODE_MISMATCH');unwrap(await db.from('arcade_pass_checkout').update({session_id:session.id}).eq('user_id',user.id));
    }
    return json({url:session.url});
   }
   return fail('Route not found.',404);
  }catch{return fail('Could not verify this request. Your account has not been granted unverified benefits. Try again or contact support.',503);}
 };
}
