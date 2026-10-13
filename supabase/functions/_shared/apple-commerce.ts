import {fulfillApplePass,passProduct} from './pass-commerce.ts';
/** Only decoded Apple-verified transactions cross this boundary. */
export const appleProducts = [
 {id:'starter',productId:'com.earnly.arcade.coins.starter',coins:500},
 {id:'plus',productId:'com.earnly.arcade.coins.plus',coins:1500},
 {id:'vault',productId:'com.earnly.arcade.coins.vault',coins:4000}
];
export function appleCommerceHandler({db,verifyUser,verifyTransaction,verifyNotification,enabled,allowSandboxTransaction}:any) {
 const origins=new Set(['capacitor://localhost','https://earnlyarcade.com','https://www.earnlyarcade.com']);
 return async(req:Request)=>{
  const origin=req.headers.get('origin');
  const headers:any={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
  const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
  const fail=(message:string,status=400)=>json({error:{message}},status);
  if(origin&&!origins.has(origin))return fail('Origin denied.',403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  const path=new URL(req.url).pathname.split('/apple-coins')[1];
  if(path==='/config'&&req.method==='GET')return json({available:!!enabled,packs:appleProducts});
  if(req.method!=='POST'||!['/verify','/notifications'].includes(path))return fail('Route not found.',404);
  if(!verifyTransaction)return fail('Apple purchases are not configured yet.',503);
  try {
   const raw=await req.text();if(raw.length>65536)return fail('Request too large.',413);
   let body;try{body=JSON.parse(raw);}catch{return fail('Invalid request.');}
   let user, signed;
   if(path==='/verify') {
    user=await verifyUser(req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]||'');
    if(!user||user.is_anonymous)return fail('Sign in to verify your purchase.',401);
    signed=body.signedTransaction;
   }else{
    if(typeof body.signedPayload!=='string')return fail('Missing signed notification.');
    const notification=await verifyNotification(body.signedPayload);
    if(!notification.data?.signedTransactionInfo)return json({received:true});
    signed=notification.data.signedTransactionInfo;
   }
   if(typeof signed!=='string'||signed.length>60000)return fail('Missing signed transaction.');
   // Runtime verifies Apple's signature and retrieves current transaction state from Apple.
   const t=await verifyTransaction(signed);
   if(t.productId===passProduct){const state=await fulfillApplePass(db,t,user?.id,allowSandboxTransaction);return json(path==='/notifications'?{received:true}:state);}
   const sandbox=t.environment==='Sandbox'&&await allowSandboxTransaction?.(t)===true;
   if((t.environment!=='Production'&&!sandbox)||t.bundleId!=='com.earnly.arcade'||t.type!=='Consumable'||t.quantity!==1||
      t.inAppOwnershipType!=='PURCHASED'||!appleProducts.some(p=>p.productId===t.productId)||
      typeof t.transactionId!=='string'||!/^\d{1,32}$/.test(t.transactionId)||
      typeof t.appAccountToken!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.appAccountToken)))return fail('This transaction is not eligible for this wallet.');
   if(user&&user.id.toLowerCase()!==t.appAccountToken.toLowerCase())return fail('Sign in to the account used for this purchase.',403);
   const {data,error}=await db.rpc(sandbox?'apple_sandbox_coin_fulfill':'apple_coin_fulfill',{p_user_id:t.appAccountToken,p_transaction_id:t.transactionId,p_product_id:t.productId,p_environment:t.environment,p_revoked:t.revocationDate!=null});
   if(error)throw error;
   return json(path==='/notifications'?{received:true}:data);
  }catch(error:any) {
   // Deliberately exclude messages, signed payloads, credentials and account identifiers.
   console.warn('APPLE_VERIFICATION_FAILURE',JSON.stringify({
    status:Number.isInteger(error?.status)?error.status:null,
    cause:typeof error?.cause?.name==='string'&&/^[A-Za-z]{1,40}$/.test(error.cause.name)?error.cause.name:null,
    unsupported:typeof error?.cause?.message==='string'&&/not implemented|not supported/i.test(error.cause.message)
   }));
   return fail('Purchase could not be verified. Reopen the shop to retry; pending purchases are kept by Apple.',503); }
 };
}
