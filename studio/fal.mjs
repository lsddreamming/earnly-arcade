// Fixed input dimensions ensure each FLUX image stays below one megapixel.
const sizes = {'9:16':[576,1024],'16:9':[1024,576],'1:1':[960,960]};
const video = 'fal-ai/wan/v2.2-5b/text-to-video/fast-wan';
export function specification(job) {
  if (!Object.hasOwn(sizes, job.ratio)) throw Error('Unsupported ratio');
  if (job.kind === 'image') {
    const [width,height] = sizes[job.ratio];
    return {endpoint:'fal-ai/flux/schnell', units:['megapixel'], maximum:0.003,
      input:{prompt:job.prompt,image_size:{width,height},num_images:1,enable_safety_checker:true,output_format:'jpeg'}};
  }
  const animation=job.kind==='animation';
  if (!animation && job.kind !== 'video') throw Error('Unsupported model');
  return {endpoint:animation?'fal-ai/wan/v2.2-5b/image-to-video':video, units:['video'], maximum:animation?0.15:0.025,
    input:{prompt:job.prompt,...(animation?{image_url:job.reference_url}:{}),resolution:'720p',aspect_ratio:job.ratio,num_frames:121,frames_per_second:24,
      enable_safety_checker:true,enable_output_safety_checker:true,enable_prompt_expansion:false}};
}
export class ProviderRejected extends Error {}
export function falProvider(key, transport=fetch) {
  const headers = {Authorization:'Key '+key,'Content-Type':'application/json'};
  async function json(url,options={}) {
    const response=await transport(url,{headers,redirect:'error',signal:AbortSignal.timeout(20000),...options});
    if(!response.ok) throw Error('Provider HTTP '+response.status);
    return response.json();
  }
  return {
    async verifyPrice(job) {
      const spec=specification(job);
      const res=await json('https://api.fal.ai/v1/models/pricing?endpoint_id='+encodeURIComponent(spec.endpoint));
      const price=res.prices?.find(p=>p.endpoint_id===spec.endpoint);
      if(!price || price.currency!=='USD' || !spec.units.includes(price.unit) ||
        !Number.isFinite(price.unit_price) || price.unit_price<=0 || price.unit_price>spec.maximum)
        throw Error('Price or unit requires review');
    },
    async submit(job) {
      const {endpoint,input}=specification(job);
      const res=await json('https://queue.fal.run/'+endpoint,{method:'POST',body:JSON.stringify(input),
        headers:{...headers,'X-Fal-No-Retry':'1','X-Fal-Store-IO':'0'}});
      if(!/^[a-zA-Z0-9-]{1,128}$/.test(res.request_id||'')) throw Error('Missing receipt');
      return res.request_id;
    },
    async billing(requestIds) {
      if(!requestIds.length)return [];
      const params=new URLSearchParams({request_id:requestIds.join(',')});
      const data=await json('https://api.fal.ai/v1/models/billing-events?'+params);
      if(!Array.isArray(data.billing_events)||data.has_more)throw Error('Incomplete billing report');
      return data.billing_events;
    },
    async result(job) {
      if(!/^[a-zA-Z0-9-]{1,128}$/.test(job.provider_request)) throw Error('Invalid receipt');
      const app=specification(job).endpoint.split('/').slice(0,2).join('/');
      const base='https://queue.fal.run/'+app+'/requests/'+job.provider_request;
      const status=await json(base+'/status');
      if(status.status!=='COMPLETED') return null;
      if(status.error||status.error_type) throw new ProviderRejected('Provider rejected the generation');
      const result=await json(base);
      if(result.has_nsfw_concepts?.some(Boolean)) throw new ProviderRejected('Output withheld');
      const file=job.kind==='image'?result.images?.[0]:result.video;
      const url=new URL(file.url);
      if(url.protocol!=='https:' || !(url.hostname==='fal.media'||url.hostname.endsWith('.fal.media'))) throw Error('Unrecognized media origin');
      return url.href;
    }
  };
}
