/* Optional authenticated adapter. Preview/offline play never mints coins. */
(()=>{'use strict';let client=null,uid=null,identified=false;
 try{if(!document.documentElement.hasAttribute('data-practice'))client=globalThis.CrystalSupabase?.createClient('https://zdwziebtbpuolusztede.supabase.co','sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ');}catch{}
 async function identity(){if(!client)return null;const {data,error}=await client.auth.getSession();if(error)throw error;const u=data?.session?.user;uid=u&&!u.is_anonymous?u.id:null;identified=true;return uid;}
 async function call(body){if(!client)throw Error('OFFLINE');const {data,error}=await client.functions.invoke('spuddy-defense',{body});if(error||data?.error)throw Error(data?.error||'OFFLINE');return data;}
 async function profile(){const id=await identity();return id?call({action:'profile'}):null;}
 async function start(options){if(!await identity())return null;return call({action:'start',map:options.map,mode:options.mode,challengeKind:options.challenge?.kind});}
 function session(saved=null){let ticket=saved?.ticket||null,sequence=saved?.sequence||0,queue=saved?.queue||[],batch=saved?.batch||{ticks:0,commands:[]},error=null,earned=saved?.earned||0,inflight=null,disabled=false;
  const data=()=>({ticket,sequence,queue,batch,earned});
  function seal(){if(!batch.ticks&&!batch.commands.length)return;queue.push(batch);batch={ticks:0,commands:[]};if(queue.length>100){disabled=true;error='CONNECTION_LOST';}}
  function record(action){if(!ticket||disabled)return;batch.commands.push({at:batch.ticks,action:JSON.parse(JSON.stringify(action))});if(batch.commands.length>=90){seal();flush().catch(()=>{});}}
  function tick(){if(!ticket||disabled)return;if(++batch.ticks>=900){seal();flush().catch(()=>{});}}
  async function flush(){if(inflight)return inflight;if(!ticket||disabled)return null;seal();inflight=(async()=>{let result=null;try{while(queue.length){if(await identity()!==ticket.userId)throw Error('ACCOUNT_CHANGED');result=await call({action:'checkpoint',id:ticket.id,sequence,batch:queue[0]});if(await identity()!==ticket.userId)throw Error('ACCOUNT_CHANGED');queue.shift();sequence=result.sequence;earned=result.earned;error=null;globalThis.dispatchEvent(new CustomEvent('defense-verified',{detail:result}));}return result;}catch(e){error=e.message;throw e;}finally{inflight=null;}})();return inflight;}
  return {record,tick,flush,data,status:()=>({verified:!!ticket&&!disabled,pending:!!inflight||queue.length>0||batch.ticks>0||batch.commands.length>0,error,earned}),setTicket(t){ticket=t;}};
 }
 if(client)client.auth.onAuthStateChange((_event,s)=>{const next=s?.user&&!s.user.is_anonymous?s.user.id:null;if(identified&&next!==uid)globalThis.dispatchEvent(new Event('defense-account-change'));});
 globalThis.SpuddyDefenseOnline={identity,profile,start,session,list:(map,mode)=>call({action:'list',map,mode})};
})();
