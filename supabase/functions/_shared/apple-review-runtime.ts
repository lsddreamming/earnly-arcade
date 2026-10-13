import {appleOptions as production} from './apple-runtime.ts';
import {appleReviewPolicy} from './apple-review-policy.ts';
import {SignedDataVerifier,AppStoreServerAPIClient,Environment} from 'npm:@apple/app-store-server-library@3.1.0';
import {Buffer} from 'node:buffer';

const roots=JSON.parse(Deno.env.get('APPLE_ROOT_CERTIFICATES_BASE64')||'[]').map((s:string)=>Buffer.from(s,'base64'));
const key=Deno.env.get('APPLE_IAP_PRIVATE_KEY'),keyId=Deno.env.get('APPLE_IAP_KEY_ID'),issuer=Deno.env.get('APPLE_IAP_ISSUER_ID');
const configured=!!production.verifyTransaction&&!!key&&!!keyId&&!!issuer;
const sandboxVerifier=configured?new SignedDataVerifier(roots,true,Environment.SANDBOX,'com.earnly.arcade'):null;
const sandboxClient=configured?new AppStoreServerAPIClient(key!,keyId!,issuer!,'com.earnly.arcade',Environment.SANDBOX):null;
const isTestAccount=async(id:string)=>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))return false;
 const {data,error}=await production.db.from('apple_sandbox_accounts').select('user_id').eq('user_id',id).maybeSingle();
 if(error)throw error;
 return !!data;
};
const policy=appleReviewPolicy({production,sandboxVerifier,sandboxClient,isTestAccount});
export const appleOptions={...production,
 verifyTransaction:configured?policy.verifyTransaction:null,
 verifyNotification:configured?policy.verifyNotification:null,
 allowSandboxTransaction:policy.allowSandboxTransaction};
