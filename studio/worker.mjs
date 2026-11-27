// Run one tick from a trusted scheduler. Caller may repeat polling, never submission.
import {createClient} from '@supabase/supabase-js';
import {falProvider,ProviderRejected,specification} from './fal.mjs';
import {markPilotMedia} from './media.mjs';
import {pathToFileURL} from 'node:url';
function unpack({data,error}) { if(error) throw Error(error.message); return data; }
async function copyMedia(url) {
  const max=32*1024*1024;
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok||Number(response.headers.get('content-length'))>max) throw Error('Media unavailable or too large');
  const parts=[]; let size=0;
  for await(const part of response.body) {
    size+=part.length;
    if(size>max) throw Error('Media exceeds limit');
    parts.push(part);
  }
  return new Blob(parts);
}
export async function tick(db,provider) {
  unpack(await db.rpc('studio_expire'));
  const purge=unpack(await db.from('studio_purge_queue').select('path').order('created_at').limit(40));
  if(purge.length){
    const paths=purge.map(row=>row.path);
    unpack(await db.storage.from('studio-private').remove(paths));
    unpack(await db.from('studio_purge_queue').delete().in('path',paths));
  }
  const outstanding=unpack(await db.from('studio_jobs').select('id,kind,ratio,provider_request,reserved_usd_micro').not('provider_request','is',null).is('billed_usd_micro',null).limit(20));
  if(outstanding.length){
    try{
      const events=await provider.billing(outstanding.map(row=>row.provider_request));
      for(const row of outstanding){
        const items=events.filter(e=>e.request_id===row.provider_request);
        if(!items.length)continue;
        if(items.some(e=>e.endpoint_id!==specification(row).endpoint || !Number.isFinite(e.cost_total) || e.cost_total<0))
          throw Error('Unrecognized provider billing event');
        const amount=Math.ceil(items.reduce((sum,item)=>sum+item.cost_total,0)*1000000);
        unpack(await db.from('studio_jobs').update({billed_usd_micro:amount}).eq('id',row.id));
        if(amount>row.reserved_usd_micro)unpack(await db.from('studio_control').update({enabled:false}).eq('singleton',true));
      }
    }catch{
      // Preserve access to previously purchased results while new spend is paused.
      unpack(await db.from('studio_control').update({enabled:false}).eq('singleton',true));
      console.warn('Studio billing reconciliation needs review');
    }
  }
  const [job]=unpack(await db.rpc('studio_claim'));
  if(job) {
    try { await provider.verifyPrice(job); }
    catch(error) {
      unpack(await db.from('studio_control').update({enabled:false}).eq('singleton',true));
      unpack(await db.rpc('studio_fail',{p_job:job.id}));
      throw error;
    }
    const control=unpack(await db.from('studio_control').select('enabled,quote_expires').single());
    if(!control.enabled || Date.parse(control.quote_expires)<=Date.now()){
      unpack(await db.rpc('studio_fail',{p_job:job.id})); return;
    }
    try {
      if(job.kind==='animation'){
        if(!job.reference_path)throw Error('Missing approved reference');
        job.reference_url=unpack(await db.storage.from('studio-private').createSignedUrl(job.reference_path,600)).signedUrl;
      }
      const receipt=await provider.submit(job);
      unpack(await db.from('studio_jobs').update({provider_request:receipt,state:'submitted'}).eq('id',job.id).eq('state','dispatching'));
    } catch(error) {
      unpack(await db.from('studio_jobs').update({state:'uncertain'}).eq('id',job.id).eq('state','dispatching'));
      throw error;
    }
  }
  const jobs=unpack(await db.from('studio_jobs').select('*').eq('state','submitted').limit(8));
  for(const row of jobs) {
    let url;
    try { url=await provider.result(row); }
    catch(error) {
      if(error instanceof ProviderRejected) unpack(await db.rpc('studio_fail',{p_job:row.id}));
      else console.warn('Studio status requires a later poll',row.id);
      continue;
    }
    if(!url) continue;
    const content=await markPilotMedia(await copyMedia(url),row.kind);
    const isImage=row.kind==='image';
    const path=row.id+(isImage?'.jpg':'.mp4');
    unpack(await db.storage.from('studio-private').upload(path,content,{contentType:isImage?'image/jpeg':'video/mp4',upsert:true}));
    const claimed=unpack(await db.from('studio_jobs').update({private_path:path,state:'output_review'}).eq('id',row.id).eq('state','submitted').eq('hidden',false).select('id'));
    if(!claimed.length){
      const current=unpack(await db.from('studio_jobs').select('hidden,private_path').eq('id',row.id).single());
      if(current.hidden||current.private_path!==path)unpack(await db.storage.from('studio-private').remove([path]));
    }
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,FAL_KEY}=process.env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!FAL_KEY) throw Error('Missing Studio worker secrets');
  await tick(createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY),falProvider(FAL_KEY));
}
