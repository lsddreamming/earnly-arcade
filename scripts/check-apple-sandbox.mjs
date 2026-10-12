// Read-only history plus a TEST notification: never submits an app or makes a purchase.
// Usage: APPLE_IAP_KEY_ID=... APPLE_IAP_ISSUER_ID=... node scripts/check-apple-sandbox.mjs /secure/key.p8
import {readFile} from 'node:fs/promises';
import {createPrivateKey,sign} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const keyFile=process.argv[2];
const keyId=process.env.APPLE_IAP_KEY_ID,issuer=process.env.APPLE_IAP_ISSUER_ID;
if(!keyFile||!keyId||!issuer)throw new Error('Provide a private-key file path, APPLE_IAP_KEY_ID and APPLE_IAP_ISSUER_ID.');
const privateKey=createPrivateKey(await readFile(keyFile));
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const unsigned=encode({alg:'ES256',kid:keyId,typ:'JWT'})+'.'+encode({iss:issuer,iat:now,exp:now+300,aud:'appstoreconnect-v1',bid:'com.earnly.arcade'});
const jwt=unsigned+'.'+sign('sha256',Buffer.from(unsigned),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
const base='https://api.storekit-sandbox.apple.com';
async function request(path,body){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 const payload=await response.json();
 return {status:response.status,payload};
}
// Do not print signed payloads, transaction history, tokens, key material or Authorization headers.
const history=await request('/inApps/v1/notifications/history',{startDate:Date.now()-3600000,endDate:Date.now()});
console.log(JSON.stringify({check:'sandbox-api-authentication',http:history.status,errorCode:history.payload.errorCode??null}));
const test=await request('/inApps/v1/notifications/test',{});
console.log(JSON.stringify({check:'request-test-notification',http:test.status,errorCode:test.payload.errorCode??null}));
if(test.status===200&&test.payload.testNotificationToken){
 let result;
 for(let attempt=0;attempt<6;attempt++){
  await delay(3000);
  result=await request('/inApps/v1/notifications/test/'+encodeURIComponent(test.payload.testNotificationToken));
  if(result.status===200&&result.payload.sendAttempts?.length)break;
  if(result.status!==200&&result.payload.errorCode!==4040008)break;
 }
 console.log(JSON.stringify({check:'notification-delivery',http:result.status,attempts:result.payload.sendAttempts??[],errorCode:result.payload.errorCode??null}));
 if(result.status!==200||!result.payload.sendAttempts?.some(attempt=>attempt.sendAttemptResult==='SUCCESS'))process.exitCode=1;
}else process.exitCode=1;
