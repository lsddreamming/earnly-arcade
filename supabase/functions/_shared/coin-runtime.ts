import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@22.6.2';
import {commerceHandler} from './coin-commerce.ts';
const secret=Deno.env.get('STRIPE_SECRET_KEY')||'';
const webhookSecret=Deno.env.get('STRIPE_WEBHOOK_SECRET')||'';
const stripe=secret.startsWith('sk_live_')?new Stripe(secret,{httpClient:Stripe.createFetchHttpClient()}):null;
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
export const handler=commerceHandler({db,stripe,
 checkoutEnabled:!!stripe&&!!webhookSecret&&Deno.env.get('COIN_CHECKOUT_ENABLED')==='true',
 verifyUser:async(token:string)=>{const {data,error}=await db.auth.getUser(token);return error?null:data.user;},
 verifyEvent:webhookSecret&&stripe?async(raw:string,signature:string)=>stripe.webhooks.constructEventAsync(raw,signature,webhookSecret,300,Stripe.createSubtleCryptoProvider()):null});
