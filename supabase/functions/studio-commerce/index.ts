// Test storefront only. Sandbox entitlements cannot fund inference.
import {appleOptions} from '../_shared/apple-review-runtime.ts';
import {sandboxStripe} from './stripe-sandbox.ts';
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
const sandbox=stripe?sandboxStripe(stripe,appleOptions.db,name=>Deno.env.get(name),record):null;
Deno.serve(async req=>{
  const origin=req.headers.get('origin');
  const allowed=['https://earnlyarcade.com','https://www.earnlyarcade.com','capacitor://localhost'];
  const headers={'Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origin&&allowed.includes(origin)?origin:allowed[0],'Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info'};
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
  if(origin&&!allowed.includes(origin))return reply({error:'Unavailable origin'},403);
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return reply({error:'POST required'},405);
  try{
    const path=new URL(req.url).pathname;
    if(path.endsWith('/stripe')){
      if(!stripe||!signing)return reply({error:'Sandbox unavailable'},503);
      const event=await stripe.webhooks.constructEventAsync(await req.text(),req.headers.get('stripe-signature')||'',signing);
      if(event.livemode)return reply({error:'Test mode required'},403);
      await sandbox!.event(event.type,event.data.object);
      return reply({received:true});
    }
    if(path.endsWith('/apple-notifications')){
      if(!appleOptions.verifyNotification||!appleOptions.verifyTransaction)return reply({error:'Sandbox unavailable'},503);
      const {signedPayload}=await req.json();
      const notice=await appleOptions.verifyNotification(signedPayload);
      if(notice.data?.environment!=='Sandbox')return reply({received:true});
      const t=await appleOptions.verifyTransaction(notice.data.signedTransactionInfo);
      await saveApple(t,t.appAccountToken);
      return reply({received:true});
    }
    const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if(!token)return reply({error:'Sign in required'},401);
    const {data:{user},error}=await appleOptions.db.auth.getUser(token);
    if(error||!user)return reply({error:'Sign in required'},401);
    const input=await req.json();
    if(path.endsWith('/allowances')){
      const {data,error}=await appleOptions.db.rpc('studio_test_allowances',{p_user:user.id});
      if(error)throw error;return reply(data);
    }
    if(path.endsWith('/checkout')||path.endsWith('/portal')){
      if(origin==='capacitor://localhost'||!sandbox||user.app_metadata?.studio_billing_tester!==true)return reply({error:'Sandbox unavailable'},403);
      return reply(path.endsWith('/portal')?await sandbox.portal(user.id):await sandbox.checkout(user.id,input.product,input.request_id));
    }
    if(!path.endsWith('/apple')||!appleOptions.verifyTransaction)return reply({error:'Sandbox unavailable'},503);
    const {signedTransaction}=input;
    if(typeof signedTransaction!=='string'||signedTransaction.length>32768)return reply({error:'Invalid transaction'},400);
    const t=await appleOptions.verifyTransaction(signedTransaction);
    await saveApple(t,user.id);
    return reply({recorded:true,sandbox:true,transactionId:t.transactionId});
  }catch{return reply({error:'Verification unsuccessful'},400);}
});

async function saveApple(t:any,uid:string){
    const product=products.get(t.productId);
    if(!product||t.environment!=='Sandbox'||t.appAccountToken?.toLowerCase()!==uid||t.bundleId!=='com.earnly.arcade'||
      t.inAppOwnershipType!=='PURCHASED'||t.quantity!==1||!/^\d{1,32}$/.test(t.transactionId)||
      t.type!==(product==='credits100'?'Consumable':'Auto-Renewable Subscription'))throw Error('Invalid Studio sandbox purchase');
    await record('apple_sandbox',t.transactionId,uid,product,product==='credits100'?null:new Date(t.expiresDate).toISOString(),t.revocationDate!=null,new Date(t.signedDate).toISOString());
}
