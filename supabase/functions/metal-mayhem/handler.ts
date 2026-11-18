import './engine.js';
import './verify.js';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
// Deployment alone does not activate rewards. The release owner must enable this separately.
export async function handleMetalMayhem(req:Request,db:any,enabled=false){
 const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 if(!enabled)return json({error:'PREVIEW_ONLY'},503);
 try{
  const text=await req.text();if(text.length>50000)return json({error:'REQUEST_TOO_LARGE'},413);
  let b:any;try{b=JSON.parse(text);}catch{return json({error:'INVALID_REQUEST'},400);}
  if(!b||typeof b!=='object')return json({error:'INVALID_REQUEST'},400);
  if(b.action==='list'){const{data,error}=await db.rpc('metal_mayhem_leaderboard');if(error)throw error;return json({entries:data||[]});}
  const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return json({error:'SIGN_IN_REQUIRED'},401);
  const{data:auth,error:authError}=await db.auth.getUser(token);if(authError||!auth?.user||auth.user.is_anonymous)return json({error:'SIGN_IN_REQUIRED'},401);
  const uid=auth.user.id;
  if(b.action==='start'){const engineVersion=(globalThis as any).MetalMayhem.VERSION;if(b.engineVersion!==engineVersion)return json({error:'ENGINE_VERSION'},409);const seed=crypto.getRandomValues(new Uint32Array(1))[0]||1;const{data,error}=await db.rpc('metal_mayhem_start',{p_user_id:uid,p_seed:seed});if(error)throw error;return json({...data,engineVersion});}
  if(b.action!=='checkpoint'||typeof b.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.id)||!Number.isInteger(b.sequence)||b.sequence<0)return json({error:'INVALID_REQUEST'},400);
  const{data:round,error}=await db.from('metal_mayhem_runs').select('id,user_id,seed,snapshot,sequence,last_receipt,finished').eq('id',b.id).eq('user_id',uid).maybeSingle();
  if(error)throw error;if(!round)return json({error:'ROUND_NOT_FOUND'},404);
  if(b.sequence===round.sequence-1&&round.last_receipt)return json({...round.last_receipt,duplicate:true,amount:0});
  if(b.sequence!==round.sequence||round.finished)return json({error:'SEQUENCE_CONFLICT'},409);
  const r=(globalThis as any).MetalMayhemVerify(round,b.steps);
  const{data,error:claimError}=await db.rpc('metal_mayhem_checkpoint',{p_user_id:uid,p_id:round.id,p_sequence:b.sequence,p_snapshot:r.snapshot,p_ticks:r.ticks,p_score:r.score,p_wave:r.wave,p_kills:r.kills,p_time:r.time,p_finished:r.finished||b.final===true});
  if(claimError)throw claimError;return json(data);
 }catch(error){const code=String((error as any)?.message||'SERVER_ERROR'),known=['ROUND_LIMIT','ROUND_NOT_FOUND','ROUND_EXPIRED','ROUND_TOO_FAST','INVALID_STEPS','INVALID_RUN','ENGINE_VERSION','SEQUENCE_CONFLICT','WALLET_UNAVAILABLE'];return json({error:known.includes(code)?code:'SERVER_ERROR'},known.includes(code)?409:500);}
}
