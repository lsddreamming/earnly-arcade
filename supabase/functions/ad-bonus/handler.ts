import {verifyReceipt,googleKeys} from './verify.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
export async function handleAdBonus(req:Request,db:any,getKeys=googleKeys){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method==='GET'){
  let receipt;
  try{receipt=verifyReceipt(req.url,await getKeys());}catch(error){
   const u=new URL(req.url);
   console.warn('Ad bonus receipt rejected', {reason:error instanceof Error?error.message:'unknown',fields:[...u.searchParams.keys()],adUnit:u.searchParams.get('ad_unit'),timestamp:u.searchParams.get('timestamp')});
   return json({error:'Invalid receipt'},400);
  }
  if(receipt.test)return json({verified:true,test:true}); // Signed AdMob dashboard probe: never a player reward.
  const r=await db.rpc('ad_bonus_complete',{p_ticket:receipt.ticket,p_transaction:receipt.transaction,p_ad_unit:receipt.unit,p_rewarded_at:receipt.time});
  return r.error?json({error:'Receipt temporarily unavailable'},503):json({accepted:true});
 }
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token||token.length>6000)return json({error:'Sign in required'},401);
  const {data,error}=await db.auth.getUser(token);const user=data?.user;
  if(error||!user||user.is_anonymous||!user.email_confirmed_at)return json({error:'Sign in required'},401);
  const raw=await req.text();if(raw.length>512)return json({error:'Request too large'},413);
  const body=JSON.parse(raw);
  if(!['status','ticket'].includes(body.action))return json({error:'Invalid action'},400);
  const args=body.action==='ticket'?{p_actor:user.id,p_placement:body.placement}:{p_actor:user.id};
  const r=await db.rpc('ad_bonus_'+body.action,args);
  return r.error?json({error:'Daily bonus unavailable. Please try again later.'},503):json(r.data);
 }catch{return json({error:'Invalid request'},400);}
}
