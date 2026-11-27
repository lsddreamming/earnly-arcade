// Run one tick from a trusted scheduler. Caller may repeat polling, never submission.
import {createClient} from '@supabase/supabase-js';
import {falProvider,ProviderRejected} from './fal.mjs';
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
    const content=await copyMedia(url);
    const isImage=row.kind==='image';
    const path=row.id+(isImage?'.jpg':'.mp4');
    unpack(await db.storage.from('studio-private').upload(path,content,{contentType:isImage?'image/jpeg':'video/mp4',upsert:true}));
    unpack(await db.from('studio_jobs').update({private_path:path,state:'output_review'}).eq('id',row.id).eq('state','submitted'));
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,FAL_KEY}=process.env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!FAL_KEY) throw Error('Missing Studio worker secrets');
  await tick(createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY),falProvider(FAL_KEY));
}
