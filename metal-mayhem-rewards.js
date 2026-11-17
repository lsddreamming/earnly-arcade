/* Only server-replayed input can award coins. Missing/unreleased backend => practice. */
(()=>{
 'use strict';
 let client;try{client=window.CrystalSupabase?.createClient('https://zdwziebtbpuolusztede.supabase.co','sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ');}catch{}
 const ids=['edge','tempo','armor','speed','dodge','regen','force','repair','pulse'];
 function quantize(v){return {x:Math.round(Math.max(-1,Math.min(1,Number(v.x)||0))*1000)/1000,z:Math.round(Math.max(-1,Math.min(1,Number(v.z)||0))*1000)/1000,yaw:Math.round(Math.atan2(Math.sin(v.yaw||0),Math.cos(v.yaw||0))*1000)/1000,attack:!!v.attack,block:!!v.block,jump:!!v.jump,dodge:!!v.dodge,upgrade:ids.includes(v.upgrade)?v.upgrade:null};}
 async function user(){if(!client)return null;const{data,error}=await client.auth.getSession();if(error)throw error;return data.session?.user||null;}
 async function call(body){if(!client)throw Error('VERIFICATION_UNAVAILABLE');const{data,error}=await client.functions.invoke('metal-mayhem',{body});if(error||data?.error)throw Error(data?.error||'VERIFICATION_UNAVAILABLE');return data;}
 async function start(){const u=await user();if(!u||u.is_anonymous)return null;return call({action:'start'});}
 function createSession(ticket){let steps=[],sequence=0,inflight=null,closed=false,final=false,error=null,earned=0,failed=false;
  const status=()=>({practice:!ticket,pending:!!inflight||steps.length>0,closed,error,earned});
  function record(raw){const v=quantize(raw);if(ticket&&!closed&&!failed){if(steps.length>=18000){failed=true;error='VERIFICATION_CONNECTION_LOST';}else{steps.push([Math.round(v.x*1000),Math.round(v.z*1000),Math.round(v.yaw*1000),Number(v.attack)|Number(v.block)<<1|Number(v.jump)<<2|Number(v.dodge)<<3,v.upgrade?ids.indexOf(v.upgrade)+1:0]);if(steps.length>=900)flush().catch(()=>{});}}return v;}
  async function flush(end=false){final=final||end;if(inflight){await inflight;if(final&&steps.length)return flush(true);return;}if(!ticket||closed||failed||!steps.length)return;
   const batch=steps.slice(0,900),isFinal=final&&batch.length===steps.length;
   inflight=(async()=>{try{if((await user())?.id!==ticket.userId)throw Error('SIGN_IN_REQUIRED');const r=await call({action:'checkpoint',id:ticket.id,sequence,steps:batch,final:isFinal});if((await user())?.id!==ticket.userId)throw Error('SIGN_IN_REQUIRED');steps.splice(0,batch.length);sequence=r.sequence;earned=r.earned;closed=!!r.finished;error=null;if(r.wallet)window.Arcade?.applyServerWallet?.(r.wallet);return r;}catch(e){error=e.message;throw e;}finally{inflight=null;}})();
   const r=await inflight;if(!closed&&steps.length&&(final||steps.length>=900))return flush(final);return r;
  }
  return {record,flush,status};
 }
 window.MetalMayhemRewards={start,leaderboard:()=>call({action:'list'}),createSession,quantize};
})();
