// Test-mode checkout and canonical reconciliation. Live Stripe keys are rejected
// by the caller. Test entitlements never increase the inference wallet.
export const catalog = {
  premium:{cents:999,env:'STUDIO_STRIPE_TEST_PREMIUM_PRICE',subscription:true},
  pro:{cents:1999,env:'STUDIO_STRIPE_TEST_PRO_PRICE',subscription:true},
  credits100:{cents:199,env:'STUDIO_STRIPE_TEST_PACK_PRICE',subscription:false}
} as const;
type Product = keyof typeof catalog;
const productKey=(value:unknown):value is Product=>typeof value==='string'&&Object.hasOwn(catalog,value);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const studioUrl='https://earnlyarcade.com/earnly-studio.html#premium';
export function sandboxStripe(stripe:any,db:any,env:(name:string)=>string|undefined,record:Function){
  const checked=(r:any)=>{if(r.error)throw r.error;return r.data;};
  async function customer(uid:string){
    const entry=checked(await db.from('studio_test_customers').select('customer_id').eq('user_id',uid).maybeSingle());
    if(entry)return entry.customer_id;
    const created=await stripe.customers.create({metadata:{earnlyUser:uid,application:'earnly-studio-test'}},{idempotencyKey:'studio-test-customer-'+uid});
    checked(await db.from('studio_test_customers').upsert({user_id:uid,customer_id:created.id},{onConflict:'user_id',ignoreDuplicates:true}));
    return checked(await db.from('studio_test_customers').select('customer_id').eq('user_id',uid).single()).customer_id;
  }
  async function matches(uid:string,id:string){
    return uuid.test(uid)&&!!checked(await db.from('studio_test_customers').select('user_id').eq('user_id',uid).eq('customer_id',id).maybeSingle());
  }
  async function checkout(uid:string,product:unknown,request:string){
    if(!productKey(product)||!uuid.test(request))throw Error('Invalid test checkout');
    const item=catalog[product],priceId=env(item.env);
    if(!priceId)throw Error('Missing sandbox product');
    const price=await stripe.prices.retrieve(priceId);
    if(!price.active||price.livemode||price.currency!=='usd'||price.unit_amount!==item.cents ||
      (item.subscription?(price.recurring?.interval!=='month'||price.recurring?.interval_count!==1):!!price.recurring))
      throw Error('Unexpected sandbox price');
    const metadata={earnlyUser:uid,studioProduct:product,application:'earnly-studio-test'};
    const session=await stripe.checkout.sessions.create({mode:item.subscription?'subscription':'payment',customer:await customer(uid),
      line_items:[{price:priceId,quantity:1}],metadata,...(item.subscription?{subscription_data:{metadata}}:{payment_intent_data:{metadata}}),
      success_url:studioUrl,cancel_url:studioUrl},{idempotencyKey:'studio-test-'+uid+'-'+request});
    const url=new URL(session.url);
    if(session.livemode||url.origin!=='https://checkout.stripe.com')throw Error('Unexpected checkout destination');
    return {url:url.href,sandbox:true};
  }
  async function pack(intentId:string){
    const intent=await stripe.paymentIntents.retrieve(intentId,{expand:['latest_charge']});
    const m=intent.metadata,ch=intent.latest_charge;
    if(!m||m.application!=='earnly-studio-test'||m.studioProduct!=='credits100'||intent.livemode||
      intent.currency!=='usd'||intent.amount_received!==catalog.credits100.cents||intent.status!=='succeeded'||
      !ch||typeof ch==='string'||!await matches(m.earnlyUser,intent.customer))return;
    const list=await stripe.checkout.sessions.list({payment_intent:intent.id,limit:2});
    if(list.has_more||list.data.length!==1)return;
    const lines=await stripe.checkout.sessions.listLineItems(list.data[0].id,{limit:2});
    const line=lines.data[0];
    if(lines.has_more||lines.data.length!==1||!line||line.quantity!==1||line.price?.id!==env(catalog.credits100.env))return;
    await record('stripe_test',intent.id,m.earnlyUser,'credits100',null,!!(ch.amount_refunded||ch.disputed),new Date().toISOString());
  }
  async function invoice(invoiceId:string,forceRevoke=false){
    const inv=await stripe.invoices.retrieve(invoiceId);
    const subId=inv.parent?.subscription_details?.subscription;
    if(inv.livemode||typeof subId!=='string')return;
    const sub=await stripe.subscriptions.retrieve(subId),m=sub.metadata,product=m?.studioProduct;
    if(!productKey(product)||product==='credits100'||m.application!=='earnly-studio-test'||sub.livemode||
      sub.customer!==inv.customer||!await matches(m.earnlyUser,sub.customer))return;
    const item=catalog[product],priceId=env(item.env);
    const line=inv.lines?.data?.[0];
    if(!priceId||inv.lines.has_more||inv.lines.data.length!==1||!line||line.pricing?.price_details?.price!==priceId||
      line.quantity!==1||inv.currency!=='usd'||!Number.isSafeInteger(line.period?.end))return;
    const payments=await stripe.invoicePayments.list({invoice:inv.id,status:'paid',limit:20});
    if(payments.has_more)throw Error('Sandbox payment review required');
    let revoked=forceRevoke||['canceled','incomplete_expired'].includes(sub.status),paid=0;
    for(const p of payments.data){
      if(p.livemode||p.payment?.type!=='payment_intent')continue;
      const intent=await stripe.paymentIntents.retrieve(p.payment.payment_intent,{expand:['latest_charge']});
      const ch=intent.latest_charge;
      if(!ch||typeof ch==='string'||intent.livemode||intent.customer!==sub.customer||intent.status!=='succeeded'||intent.currency!=='usd')continue;
      revoked||=!!(ch.amount_refunded||ch.disputed);
      paid+=p.amount_paid;
    }
    if(!revoked&&(inv.status!=='paid'||paid<item.cents||inv.amount_paid<item.cents))return;
    await record('stripe_test',inv.id,m.earnlyUser,product,new Date(line.period.end*1000).toISOString(),revoked,new Date().toISOString());
  }
  async function event(type:string,o:any){
    if(type.startsWith('invoice.')&&o.object==='invoice')return invoice(o.id);
    if(type.startsWith('customer.subscription.')&&o.latest_invoice)return invoice(o.latest_invoice);
    if(type.startsWith('checkout.session.')&&o.payment_intent)return pack(o.payment_intent);
    if(['charge.refunded','charge.dispute.created','charge.dispute.closed'].includes(type)&&o.payment_intent){
      await pack(o.payment_intent);
      const payments=await stripe.invoicePayments.list({payment:{type:'payment_intent',payment_intent:o.payment_intent},limit:20});
      if(payments.has_more)throw Error('Payment review required');
      for(const p of payments.data)if(typeof p.invoice==='string')await invoice(p.invoice,type==='charge.dispute.created'||type==='charge.refunded');
    }
  }
  async function portal(uid:string){
    const session=await stripe.billingPortal.sessions.create({customer:await customer(uid),return_url:studioUrl});
    const url=new URL(session.url);
    if(url.origin!=='https://billing.stripe.com')throw Error('Unexpected sandbox portal');
    return {url:url.href,sandbox:true};
  }
  return {checkout,event,portal};
}
