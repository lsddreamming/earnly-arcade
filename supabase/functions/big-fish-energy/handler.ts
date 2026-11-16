import './engine.js';
import './verify.js';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
export async function handleBigFish(req:Request,db:any){
 const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 try{
  const text=await req.text();if(text.length>50000)return json({error:'REQUEST_TOO_LARGE'},413);
  let b:any;try{b=JSON.parse(text);}catch{return json({error:'INVALID_REQUEST'},400);}
  if(!b||typeof b!=='object')return json({error:'INVALID_REQUEST'},400);
  if(b.action==='list') {const {data,error}=await db.rpc('big_fish_leaderboard');if(error)throw error;return json({entries:data||[]});}
  const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');
  if(!token)return json({error:'SIGN_IN_REQUIRED'},401);
  const {data:auth,error:authError}=await db.auth.getUser(token);
  if(authError||!auth?.user||auth.user.is_anonymous)return json({error:'SIGN_IN_REQUIRED'},401);
  const uid=auth.user.id;
  if(b.action==='start'){
   if(!['endless','timed','predator'].includes(b.mode))return json({error:'INVALID_MODE'},400);
   const seed=crypto.getRandomValues(new Uint32Array(1))[0]||1;
   const {data,error}=await db.rpc('big_fish_start',{p_user_id:uid,p_seed:seed,p_mode:b.mode});if(error)throw error;return json(data);
  }
  if(b.action!=='checkpoint'||typeof b.id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.id)||!Number.isInteger(b.sequence)||b.sequence<0)return json({error:'INVALID_REQUEST'},400);
  const {data:round,error}=await db.from('big_fish_runs').select('id,user_id,seed,mode,snapshot,sequence,last_receipt,finished').eq('id',b.id).eq('user_id',uid).maybeSingle();
  if(error)throw error;if(!round)return json({error:'ROUND_NOT_FOUND'},404);
  if(b.sequence===round.sequence-1&&round.last_receipt)return json({...round.last_receipt,duplicate:true,amount:0});
  if(b.sequence!==round.sequence||round.finished)return json({error:'SEQUENCE_CONFLICT'},409);
  const result=(globalThis as any).BigFishVerify(round,b.steps);
  const {data,error:claimError}=await db.rpc('big_fish_checkpoint',{p_user_id:uid,p_id:round.id,p_sequence:b.sequence,p_snapshot:result.snapshot,p_ticks:result.ticks,p_size:result.size,p_eaten:result.eaten,p_time:result.time,p_finished:result.finished||b.final===true});
  if(claimError)throw claimError;return json(data);
 }catch(error){
  const code=String((error as any)?.message||'SERVER_ERROR'),known=['ROUND_LIMIT','ROUND_NOT_FOUND','ROUND_EXPIRED','ROUND_TOO_FAST','INVALID_STEPS','INVALID_RUN','SEQUENCE_CONFLICT','WALLET_UNAVAILABLE'];
  return json({error:known.includes(code)?code:'SERVER_ERROR'},known.includes(code)?409:500);
 }
}
