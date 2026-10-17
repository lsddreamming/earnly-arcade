/* Optional first-party telemetry. Never blocks gameplay or purchases. */
(()=>{
 const endpoint='https://zdwziebtbpuolusztede.supabase.co/functions/v1/activity';
 const recent=new Map();
 async function request(body){
  const session=await window.EarnlyCloud?.session?.();
  if(!session)return null;
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(5000),cache:'no-store'});
  if(!response.ok)throw new Error(response.status===403?'Owner access required.':'Activity is temporarily unavailable.');
  return response.json();
 }
 function track(kind){
  if(['localhost','127.0.0.1','::1'].includes(location.hostname))return;
  const now=Date.now();if(now-(recent.get(kind)||0)<1000)return;recent.set(kind,now);
  try{void request({action:'event',id:crypto.randomUUID(),kind}).catch(()=>{});}catch{}
 }
 window.EarnlyActivity={track,request};
 const link=document.getElementById('ownerActivityLink');
 if(link)request({action:'access'}).then(r=>{link.hidden=!r?.owner;}).catch(()=>{});
})();
