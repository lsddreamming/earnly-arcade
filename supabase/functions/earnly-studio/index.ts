import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import jpeg from 'npm:jpeg-js@0.4.4';
import {googleKeys,verifyReceipt} from '../ad-bonus/verify.ts';
const adUnit=Deno.env.get('STUDIO_ADMOB_UNIT')||'';
const adConfigured=/^ca-app-pub-8864401806510610\/\d{10}$/.test(adUnit)&&!['8249888009','1831908609'].includes(adUnit.split('/')[1]);
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Cache-Control':'no-store'};
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:cors});
function checked<T>({data,error}:{data:T,error:unknown}):T {if(error)throw error; return data;}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method==='GET' && adConfigured){
    try{
      const receipt=verifyReceipt(req.url,await googleKeys(),Date.now(),new Set([adUnit]));
      if(receipt.test)return response({test:true,credited:false});
      checked(await db.rpc('studio_ad_complete',{p_ticket:receipt.ticket,p_unit:receipt.unit,p_event:receipt.transaction,p_time:receipt.time}));
      return response({ok:true});
    }catch{return response({error:'Reward verification failed'},400);}
  }
  if(req.method!=='POST')return response({error:'POST required'},405);
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return response({error:'Sign in required'},401);
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)return response({error:'Sign in required'},401);
  try {
    const text=await req.text();
    if(text.length>720000)return response({error:'Request too large'},413);
    const b=JSON.parse(text);
    const admin=user.app_metadata?.studio_admin===true;
    if(b.action==='library'){
      const acct=checked(await db.from('studio_accounts').select('credits,pilot,community_eligible').eq('user_id',user.id).maybeSingle());
      const cfg=checked(await db.from('studio_control').select('enabled,quote_expires,community_enabled').single());
      const jobs=checked(await db.from('studio_jobs').select('id,title,prompt,kind,ratio,state,created_at,private_path,studio_posts(state)').eq('user_id',user.id).eq('hidden',false).order('created_at',{ascending:false}).limit(100));
      const rows=await Promise.all(jobs.map(async({private_path,studio_posts,...row})=>({...row,publication:(Array.isArray(studio_posts)?studio_posts[0]:studio_posts)?.state||null,url:row.state==='ready'&&private_path?checked(await db.storage.from('studio-private').createSignedUrl(private_path,300)).signedUrl:null})));
      const pool=adConfigured&&acct?.pilot?checked(await db.from('studio_ad_pool').select('enabled,remaining,reward').single()):null;
      const models=checked(await db.from('studio_models').select('kind,credits').eq('enabled',true));
      return response({community:!!(cfg.community_enabled&&acct?.community_eligible&&acct?.pilot),adOffer:!!(pool?.enabled&&pool.remaining>=pool.reward&&cfg.enabled&&Date.parse(cfg.quote_expires)>Date.now()),prices:Object.fromEntries(models.map(m=>[m.kind,m.credits])),credits:acct?.credits||0,enabled:!!(acct?.pilot&&cfg.enabled&&Date.parse(cfg.quote_expires)>Date.now()),admin,jobs:rows});
    }
    if(b.action==='ad_ticket' && adConfigured)return response(checked(await db.rpc('studio_ad_ticket',{p_user:user.id,p_unit:adUnit})));
    if(b.action==='generate'){
      if(b.consent_version!=='2026-11-27')return response({error:'Permission to send this prompt to fal is required'},400);
      if(!Number.isInteger(b.expected_credits)||b.expected_credits<1||!uuid.test(b.request_id)||typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>1200||!['image','video','animation'].includes(b.kind)||!['9:16','16:9','1:1'].includes(b.ratio))return response({error:'Invalid creation settings'},400);
      let bytes:Uint8Array|null=null,hash:string|null=null;
      if(b.kind==='animation'){
        const account=checked(await db.from('studio_accounts').select('pilot').eq('user_id',user.id).single());
        if(!account.pilot||typeof b.image_base64!=='string'||b.image_base64.length>699052)return response({error:'Invalid reference'},400);
        const raw=Uint8Array.from(atob(b.image_base64),c=>c.charCodeAt(0));
        if(raw.length>524288||raw[0]!==255||raw[1]!==216)return response({error:'JPEG reference required'},400);
        const decoded=jpeg.decode(raw,{useTArray:true,maxResolutionInMP:1.64,maxMemoryUsageInMB:48});
        if(decoded.width>1280||decoded.height>1280)return response({error:'Resize reference before upload'},400);
        // Re-encode only pixel data. Drop filenames, EXIF, GPS and embedded comments.
        bytes=jpeg.encode({width:decoded.width,height:decoded.height,data:decoded.data},80).data;
        hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),n=>n.toString(16).padStart(2,'0')).join('');
      }
      const id=checked(await db.rpc('studio_reserve',{p_user:user.id,p_request:b.request_id,p_kind:b.kind,p_prompt:b.prompt.trim(),p_ratio:b.ratio,p_hash:hash,p_quote:b.expected_credits}));
      if(bytes){
        const job=checked(await db.from('studio_jobs').select('state,reference_path').eq('id',id).single());
        if(job.state==='review'&&!job.reference_path){
          const path=id+'-reference.jpg';
          checked(await db.storage.from('studio-private').upload(path,bytes,{contentType:'image/jpeg',upsert:true}));
          checked(await db.from('studio_jobs').update({reference_path:path}).eq('id',id).eq('state','review'));
        }
      }
      return response({id});
    }
    if(['rename','delete'].includes(b.action)&&uuid.test(b.id)){
      const row=checked(await db.from('studio_jobs').select('private_path,reference_path,state').eq('id',b.id).eq('user_id',user.id).in('state',['ready','failed']).single());
      if(b.action==='rename'){
        if(typeof b.title!=='string'||!b.title.trim()||b.title.length>80)return response({error:'Invalid title'},400);
        checked(await db.from('studio_jobs').update({title:b.title.trim()}).eq('user_id',user.id).eq('hidden',false).eq('id',b.id));
      }else{
        checked(await db.from('studio_jobs').update({hidden:true,title:null,prompt:'[deleted]',private_path:null,reference_path:null,reference_hash:null}).eq('id',b.id).eq('user_id',user.id));
        const paths=[row.private_path,row.reference_path].filter(Boolean);
        if(paths.length)await db.storage.from('studio-private').remove(paths);
      }
      return response({ok:true});
    }
    if(b.action==='community'){
      const result=checked(await db.rpc('studio_community',{p_user:user.id,p_action:b.operation,p_id:b.id||null,p_text:b.text||''}));
      if(!Array.isArray(result))return response(result);
      return response({posts:await Promise.all(result.map(async({private_path,...row})=>({...row,url:checked(await db.storage.from('studio-private').createSignedUrl(private_path,120)).signedUrl})))});
    }
    if(admin && b.action==='community_queue'){
      const posts=checked(await db.from('studio_posts').select('job_id,creator,studio_jobs(prompt,private_path,kind)').eq('state','review').limit(20));
      const comments=checked(await db.from('studio_comments').select('id,body,job_id').eq('approved',false).limit(30));
      const reports=checked(await db.from('studio_reports').select('job_id,user_id,reason').limit(30));
      return response({comments,reports,posts:await Promise.all(posts.map(async p=>{
        const job=Array.isArray(p.studio_jobs)?p.studio_jobs[0]:p.studio_jobs;
        return {id:p.job_id,prompt:job.prompt,kind:job.kind,url:checked(await db.storage.from('studio-private').createSignedUrl(job.private_path,120)).signedUrl};
      }))});
    }
    if(admin&&b.action==='moderate_community'&&uuid.test(b.id)){
      if(b.target==='post')checked(await db.from('studio_posts').update({state:b.approve===true?'published':'rejected'}).eq('job_id',b.id).in('state',b.approve===true?['review']:['review','published']).select('job_id').single());
      else if(b.target==='comment'){
        if(b.approve===true)checked(await db.from('studio_comments').update({approved:true}).eq('id',b.id));
        else checked(await db.from('studio_comments').delete().eq('id',b.id));
      }else return response({error:'Invalid target'},400);
      return response({ok:true});
    }
    if(admin&&b.action==='model'){
      if(!['image','video','animation'].includes(b.kind)||typeof b.enabled!=='boolean'||!Number.isInteger(b.credits)||b.credits<1||b.credits>10000)return response({error:'Invalid model settings'},400);
      checked(await db.from('studio_models').update({credits:b.credits,enabled:b.enabled}).eq('kind',b.kind));
      return response({ok:true});
    }
    if(admin && b.action==='limits'){
      const allowed=['daily_limit','monthly_limit','fal_limit','daily_jobs','user_jobs','concurrent_jobs'];
      if(!allowed.includes(b.setting)||!Number.isSafeInteger(b.value)||b.value<0)return response({error:'Invalid setting'},400);
      checked(await db.from('studio_control').update({[b.setting]:b.value}).eq('singleton',true));
      return response({ok:true});
    }
    if(admin && b.action==='admin') {
      const config=checked(await db.from('studio_control').select('*').single());
      const totals=checked(await db.rpc('studio_overview'));
      const jobs=checked(await db.from('studio_jobs').select('id,kind,prompt,state,created_at,private_path,reference_path').in('state',['review','output_review','uncertain']).order('created_at').limit(30));
      return response({models:checked(await db.from('studio_models').select('kind,credits,enabled')),config,totals,jobs:await Promise.all(jobs.map(async({private_path,reference_path,...row})=>({...row,reference_url:reference_path?checked(await db.storage.from('studio-private').createSignedUrl(reference_path,180)).signedUrl:null,url:private_path?checked(await db.storage.from('studio-private').createSignedUrl(private_path,180)).signedUrl:null})))});
    }
    if(admin && b.action==='pause'){
      checked(await db.from('studio_control').update({enabled:false}).eq('singleton',true));
      return response({paused:true});
    }
    if(admin && uuid.test(b.id) && ['approve','reject'].includes(b.action)){
      // Conditional transition keeps simultaneous reviewers from overriding one another.
      if(b.action==='reject')checked(await db.rpc('studio_reject',{p_job:b.id}));
      else {
        const next=b.stage==='review'?'queued':b.stage==='output_review'?'ready':null;
        if(!next)return response({error:'Invalid review stage'},400);
        checked(await db.from('studio_jobs').update({state:next}).eq('id',b.id).eq('state',b.stage).or('kind.neq.animation,reference_path.not.is.null').select('id').single());
      }
      return response({ok:true});
    }
    return response({error:'Unavailable action'},403);
  }catch(err){
    const details=(err as Error)?.message||'';
    const code=['STUDIO_PAUSED','MODEL_PAUSED','QUOTE_CHANGED','STUDIO_LIMIT','REQUEST_CONFLICT','PILOT_OR_CREDITS_REQUIRED'].find(x=>details.includes(x));
    return response({error:code||'Unable to complete Studio request'},code?409:400);
  }
});
