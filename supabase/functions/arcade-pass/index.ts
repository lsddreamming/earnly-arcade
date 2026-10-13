import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@22.6.2';
import {appleOptions} from '../_shared/apple-review-runtime.ts';
import {passHandler} from '../_shared/pass-commerce.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const key=Deno.env.get('STRIPE_SECRET_KEY')||'',secret=Deno.env.get('STRIPE_PASS_WEBHOOK_SECRET')||'';
const stripe=/^(sk|rk)_live_/.test(key)?new Stripe(key,{httpClient:Stripe.createFetchHttpClient(),apiVersion:'2026-08-26.dahlia'}):null;
Deno.serve(passHandler({db,stripe,verifyUser:appleOptions.verifyUser,verifyTransaction:appleOptions.verifyTransaction,
 allowSandboxTransaction:appleOptions.allowSandboxTransaction,
 paymentsVerified:Deno.env.get('SHOP_TWO_PAYMENTS_VERIFIED')==='true',
 priceId:Deno.env.get('STRIPE_PASS_PRICE_ID'),webEnabled:!!stripe&&!!secret&&Deno.env.get('ARCADE_PASS_WEB_ENABLED')==='true',
 appleEnabled:appleOptions.enabled&&Deno.env.get('ARCADE_PASS_APPLE_ENABLED')==='true',
 verifyEvent:stripe&&secret?(raw:string,sig:string)=>stripe.webhooks.constructEventAsync(raw,sig,secret,300,Stripe.createSubtleCryptoProvider()):null}));
