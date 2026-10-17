const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clientKinds=new Set(['world_attempt','world_failure','world_reconnect','shop_view','purchase_attempt']);
export async function handleActivity(req:Request,admin:any){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'POST required'},405);
 try{
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token||token.length>6000)return json({error:'Sign in required'},401);
  const {data,error}=await admin.auth.getUser(token);const user=data?.user;
  if(error||!user||user.is_anonymous||!user.email_confirmed_at)return json({error:'Sign in required'},401);
  const raw=await req.text();if(raw.length>1024)return json({error:'Request too large'},413);
  const body=JSON.parse(raw);
  if(body.action==='event'){
   if(!clientKinds.has(body.kind)||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id||''))return json({error:'Invalid event'},400);
   const r=await admin.rpc('activity_record',{p_actor:user.id,p_id:body.id,p_kind:body.kind});
   if(r.error)return json({error:'Activity unavailable'},503);
   return json({ok:true,recorded:r.data===true});
  }
  const access=await admin.rpc('activity_owner_access',{p_actor:user.id});
  if(access.error)return json({error:'Activity unavailable'},503);
  if(access.data!==true)return json({error:'Owner access required'},403);
  if(body.action==='access')return json({owner:true});
  if(body.action!=='report'||![1,7,30].includes(body.days)||typeof body.includeTests!=='boolean')return json({error:'Invalid request'},400);
  const r=await admin.rpc('activity_report',{p_actor:user.id,p_days:body.days,p_include_tests:body.includeTests});
  return r.error?json({error:'Report unavailable'},503):json(r.data);
 }catch{return json({error:'Request unavailable'},400);}
}
