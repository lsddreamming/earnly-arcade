// Sandbox-only verification. No checkout or live transaction delivery.
import {appleOptions} from '../_shared/apple-review-runtime.ts';
import Stripe from 'npm:stripe@22.6.2';
const products=new Map([['com.earnly.arcade.studio.premium.monthly','premium'],['com.earnly.arcade.studio.pro.monthly','pro'],['com.earnly.arcade.studio.credits100','credits100']]);
const stripeKey=Deno.env.get('STUDIO_STRIPE_TEST_KEY')||'';
const stripe=stripeKey.startsWith('sk_test_')?new Stripe(stripeKey):null;
const signing=Deno.env.get('STUDIO_STRIPE_TEST_WEBHOOK');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function record(provider:string,id:string,uid:string,product:string,until:string|null,revoked:boolean,observed:string){
  const {error}=await appleOptions.db.rpc('studio_test_purchase',{p_provider:provider,p_transaction:id,p_user:uid,p_product:product,p_until:until,p_revoked:revoked,p_observed:observed});
  if(error)throw error;
}
Deno.serve(async req=>{
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(req.method!=='POST')return reply({error:'POST required'},405);
  try{
    const path=new URL(req.url).pathname;
    if(path.endsWith('/stripe')){
      if(!stripe||!signing)return reply({error:'Sandbox unavailable'},503);
      const event=await stripe.webhooks.constructEventAsync(await req.text(),req.headers.get('stripe-signature')||'',signing);
      if(event.livemode)return reply({error:'Test mode required'},403);
      // Record only a retrieved, paid Studio credit pack from a server-created
      // session with an allowlisted Price. Never trust client supplied metadata.
      if(event.type!=='checkout.session.completed' && event.type!=='checkout.session.async_payment_succeeded')return reply({received:true});
      const session=await stripe.checkout.sessions.retrieve(event.data.object.id,{expand:['line_items','payment_intent.latest_charge']});
      const line=session.line_items?.data[0], expected=Deno.env.get('STUDIO_STRIPE_TEST_PACK_PRICE');
      const intent=session.payment_intent, uid=session.metadata?.earnlyUser;
      if(!expected || !uid || !uuid.test(uid) || session.metadata?.earnlyProduct!=='studio_credits100' ||
        session.livemode || session.mode!=='payment' || session.payment_status!=='paid' || !line || line.quantity!==1 ||
        session.line_items?.has_more || session.line_items?.data.length!==1 || line.price?.id!==expected ||
        !intent || typeof intent==='string' || intent.status!=='succeeded' || intent.amount_received<=0 ||
        !intent.latest_charge || typeof intent.latest_charge==='string')return reply({received:true});
      const ch=intent.latest_charge;
      await record('stripe_test',intent.id,uid,'credits100',null,!!(ch.amount_refunded||ch.disputed),new Date().toISOString());
      return reply({recorded:true});
    }
    if(!path.endsWith('/apple')||!appleOptions.verifyTransaction)return reply({error:'Sandbox unavailable'},503);
    const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if(!token)return reply({error:'Sign in required'},401);
    const {data:{user},error}=await appleOptions.db.auth.getUser(token);
    if(error||!user)return reply({error:'Sign in required'},401);
    const {signedTransaction}=await req.json();
    if(typeof signedTransaction!=='string'||signedTransaction.length>32768)return reply({error:'Invalid transaction'},400);
    const t=await appleOptions.verifyTransaction(signedTransaction);
    const product=products.get(t.productId);
    if(!product||t.environment!=='Sandbox'||t.appAccountToken?.toLowerCase()!==user.id||t.bundleId!=='com.earnly.arcade'||
      t.inAppOwnershipType!=='PURCHASED'||t.quantity!==1||!/^\d{1,32}$/.test(t.transactionId)||
      t.type!==(product==='credits100'?'Consumable':'Auto-Renewable Subscription'))return reply({error:'Invalid Studio sandbox purchase'},403);
    await record('apple_sandbox',t.transactionId,user.id,product,product==='credits100'?null:new Date(t.expiresDate).toISOString(),t.revocationDate!=null,new Date(t.signedDate).toISOString());
    return reply({recorded:true,sandbox:true,transactionId:t.transactionId});
  }catch{return reply({error:'Verification unsuccessful'},400);}
});
