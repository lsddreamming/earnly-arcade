/* Only server-replayed runs can award Arcade Coins or publish rankings. */
(()=>{
 'use strict';
 let client;
 try{client=window.CrystalSupabase?.createClient('https://zdwziebtbpuolusztede.supabase.co','sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ');}catch{}
 const quantize=input=>({x:Math.round(Math.max(-1,Math.min(1,Number(input.x)||0))*1000)/1000,y:Math.round(Math.max(-1,Math.min(1,Number(input.y)||0))*1000)/1000,boost:!!input.boost});
 async function user(){if(!client)return null;const {data,error}=await client.auth.getSession();if(error)throw error;return data.session?.user||null;}
 async function call(body){if(!client)throw Error('REWARDS_UNAVAILABLE');const {data,error}=await client.functions.invoke('big-fish-energy',{body});if(error)throw Error('REWARDS_UNAVAILABLE');if(data?.error)throw Error(data.error);return data;}
 async function start(mode='endless'){const u=await user();if(!u||u.is_anonymous)return null;return call({action:'start',mode});}
 async function leaderboard(){return call({action:'list'});}
 function createSession(ticket){
  let steps=[],sequence=0,inflight=null,closed=false,pendingFinal=false,error=null,earned=0,verifiedSize=null,overflow=false;
  const status=()=>({practice:!ticket,pending:!!inflight||steps.length>0,error,earned,verifiedSize,closed});
  function record(raw){const v=quantize(raw);if(ticket&&!closed&&!overflow){if(steps.length>=18000){overflow=true;error='VERIFICATION_CONNECTION_LOST';}else{steps.push([Math.round(v.x*1000),Math.round(v.y*1000),Number(v.boost)]);if(steps.length>=1800)flush().catch(()=>{});}}return v;}
  async function flush(final=false){
   pendingFinal=pendingFinal||final;if(inflight){await inflight;if(pendingFinal&&steps.length)return flush(true);return;}
   if(!ticket||closed||overflow||!steps.length)return;
   const count=Math.min(1800,steps.length),batch=steps.slice(0,count),isFinal=pendingFinal&&count===steps.length;
   inflight=(async()=>{
    try{
     if((await user())?.id!==ticket.userId)throw Error('SIGN_IN_REQUIRED');
     const r=await call({action:'checkpoint',id:ticket.id,sequence,steps:batch,final:isFinal});
     if((await user())?.id!==ticket.userId)throw Error('SIGN_IN_REQUIRED');
     steps.splice(0,count);sequence=r.sequence;earned=r.earned;verifiedSize=r.size;closed=!!r.finished;error=null;
     if(r.wallet&&window.Arcade?.applyServerWallet)window.Arcade.applyServerWallet(r.wallet);
     window.dispatchEvent(new CustomEvent('big-fish-verified',{detail:r}));return r;
    }catch(e){error=e.message||'REWARDS_UNAVAILABLE';throw e;}finally{inflight=null;}
   })();
   const r=await inflight;if(!closed&&steps.length&&(pendingFinal||steps.length>=1800))return flush(pendingFinal);return r;
  }
  return {record,flush,status};
 }
 window.BigFishRewards={start,leaderboard,createSession,quantize};
})();
