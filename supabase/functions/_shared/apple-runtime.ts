import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {SignedDataVerifier,AppStoreServerAPIClient,Environment} from 'npm:@apple/app-store-server-library@3.1.0';
import {installAppleX509Compatibility} from './apple-x509-compat.ts';
import {Buffer} from 'node:buffer';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
// DER roots from Apple's PKI, provisioned by operator, never client-supplied x5c roots.
const roots=JSON.parse(Deno.env.get('APPLE_ROOT_CERTIFICATES_BASE64')||'[]').map((s:string)=>Buffer.from(s,'base64'));
if(roots.length)installAppleX509Compatibility(roots[0]);
const appId=Number(Deno.env.get('APPLE_APP_ID'));
const key=Deno.env.get('APPLE_IAP_PRIVATE_KEY'),keyId=Deno.env.get('APPLE_IAP_KEY_ID'),issuer=Deno.env.get('APPLE_IAP_ISSUER_ID');
const configured=roots.length>0&&Number.isSafeInteger(appId)&&appId>0&&!!key&&!!keyId&&!!issuer;
const verifier=configured?new SignedDataVerifier(roots,true,Environment.PRODUCTION,'com.earnly.arcade',appId):null;
const client=configured?new AppStoreServerAPIClient(key!,keyId!,issuer!,'com.earnly.arcade',Environment.PRODUCTION):null;
export const appleOptions={db,enabled:configured&&Deno.env.get('APPLE_COIN_PURCHASES_ENABLED')==='true'&&Deno.env.get('SHOP_TWO_PAYMENTS_VERIFIED')==='true',
 verifyUser:async(token:string)=>{if(!token)return null;const {data,error}=await db.auth.getUser(token);return error?null:data.user;},
 verifyNotification:verifier?(s:string)=>verifier.verifyAndDecodeNotification(s):null,
 verifyTransaction:verifier&&client?async(s:string)=>{
  const original=await verifier.verifyAndDecodeTransaction(s);
  if(!original.transactionId)throw new Error('Missing transaction');
  const current=await client.getTransactionInfo(original.transactionId);
  const transaction=await verifier.verifyAndDecodeTransaction(current.signedTransactionInfo!);
  if(transaction.transactionId!==original.transactionId||transaction.appAccountToken!==original.appAccountToken||transaction.productId!==original.productId)throw new Error('Transaction mismatch');
  // A signed refund notification cannot be undone by stale provider read replication.
  return {...transaction,revocationDate:original.revocationDate??transaction.revocationDate};
 }:null};
