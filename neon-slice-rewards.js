/* Account rewards are authoritative only after the server returns a wallet. */
(()=>{
 let client;try{client=window.CrystalSupabase?.createClient('https://zdwziebtbpuolusztede.supabase.co','sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ');}catch{}
 const queueKey='earnlyNeonSlicePending';
 function load(){try{return JSON.parse(localStorage.getItem(queueKey)||'[]').filter(x=>x&&typeof x.id==='string'&&Array.isArray(x.events)).slice(-5);}catch{return [];}}
 function store(q){try{localStorage.setItem(queueKey,JSON.stringify(q.slice(-5)));}catch{}}
 async function user(){if(!client)return null;const {data,error}=await client.auth.getSession();if(error)throw error;return data.session?.user||null;}
 async function call(body){const {data,error}=await client.functions.invoke('neon-slice',{body});if(error){let code;try{code=(await error.context.json()).error;}catch{}throw Error(code||'CONNECTION');}if(data?.error)throw Error(data.error);return data;}
 function apply(wallet){
  if(!wallet)return;
  if(window.Arcade?.applyServerWallet){window.Arcade.applyServerWallet(wallet);return;}
  try{localStorage.setItem('points',String(wallet.balance));localStorage.setItem('lifetimePoints',String(Math.max(Number(wallet.balance),Number(wallet.lifetime_earned))));localStorage.setItem('arcadeShadowWallet',JSON.stringify({balance:Number(wallet.balance),lifetime:Number(wallet.lifetime_earned),checkedAt:new Date().toISOString()}));}catch{}
  window.dispatchEvent(new CustomEvent('earnly-wallet-change',{detail:{balance:Number(wallet.balance),lifetime:Number(wallet.lifetime_earned)}}));
 }
 async function start(){const u=await user();if(!u||u.is_anonymous)return null;const round=await call({action:'start',engineVersion:2});if(round?.id&&round.engineVersion!==2)throw Error('ENGINE_VERSION');return round;}
 async function claim(round,events,ticks){
  const pending={id:round.id,userId:round.userId,events,ticks};store([...load().filter(x=>x.id!==round.id),pending]);
  const u=await user();if(!u||u.id!==round.userId)throw Error('SIGN_IN_REQUIRED');
  const result=await call({action:'claim',id:round.id,events,ticks});store(load().filter(x=>x.id!==round.id));
  if((await user())?.id!==u.id)throw Error('SIGN_IN_REQUIRED');
  apply(result.wallet);return result;
 }
 async function retry(){const u=await user();if(!u)return [];const results=[];for(const q of load().filter(x=>x.userId===u.id)){try{results.push(await claim(q,q.events,q.ticks));}catch(e){if(['ROUND_EXPIRED','ROUND_NOT_FOUND','INVALID_RUN','RUN_NOT_FINISHED'].includes(e.message))store(load().filter(x=>x.id!==q.id));else throw e;}}return results;}
 window.NeonSliceRewards={start,claim,retry,hasPending:()=>load().length>0};
})();
