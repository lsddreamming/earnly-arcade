import './engine.js';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json'};
export async function handleNeonSlice(req:Request,db:any){
 const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');
  if(!token)return json({error:'SIGN_IN_REQUIRED'},401);
  const {data:auth,error:authError}=await db.auth.getUser(token);
  if(authError||!auth?.user||auth.user.is_anonymous)return json({error:'SIGN_IN_REQUIRED'},401);
  const text=await req.text();if(text.length>600000)return json({error:'REQUEST_TOO_LARGE'},413);
  const b=JSON.parse(text),uid=auth.user.id;
  if(b.action==='start'){
   if(b.engineVersion!==undefined&&b.engineVersion!==1&&b.engineVersion!==2&&b.engineVersion!==3)return json({error:'INVALID_REQUEST'},400);
   const seed=crypto.getRandomValues(new Uint32Array(1))[0]||1;
   const {data,error}=await db.rpc(b.engineVersion===3?'neon_slice_start_v3':b.engineVersion===2?'neon_slice_start_v2':'neon_slice_start',{p_user_id:uid,p_seed:seed});if(error)throw error;return json(data);
  }
  if(b.action!=='claim'||typeof b.id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.id))return json({error:'INVALID_REQUEST'},400);
  const {data:round,error}=await db.from('neon_slice_rounds').select('id,user_id,seed,engine_version').eq('id',b.id).eq('user_id',uid).maybeSingle();
  if(error)throw error;if(!round)return json({error:'ROUND_NOT_FOUND'},404);
  const result=(globalThis as any).NeonSliceEngine.verify(Number(round.seed),b.events,b.ticks,round.engine_version??1);
  const claim=await db.rpc('neon_slice_claim',{p_user_id:uid,p_round_id:round.id,p_score:result.score,p_ticks:result.ticks});
  if(claim.error)throw claim.error;return json(claim.data);
 }catch(error){
  const code=String((error as any)?.message||'SERVER_ERROR');
  const known=['ROUND_LIMIT','ROUND_NOT_FOUND','ROUND_EXPIRED','ROUND_TOO_FAST','INVALID_RUN','RUN_NOT_FINISHED','WALLET_UNAVAILABLE'];
  return json({error:known.includes(code)?code:'SERVER_ERROR'},known.includes(code)?409:500);
 }
}
