/* Each entry stores the commands up to a cleared wave; the server reconstructs the score. */
window.PatchCup = (() => {
  const endpoint='https://zdwziebtbpuolusztede.supabase.co';
  const key='sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ';
  const slot='earnly.patchCup.best.v1';
  let auth;
  function record(state,action) {
    if(state.challenge?.kind!=='weekly'||state.wave>5||state.completed>=5)return;
    if(!state.cupMoves && state.tick===0)state.cupMoves=[];
    if(state.cupMoves && state.cupMoves.length<501)state.cupMoves.push({at:state.tick,action:{...action}});
  }
  function read(){
    try{return JSON.parse(localStorage.getItem(slot));}catch{return null;}
  }
  function finish(state){
    if(state.challenge?.kind!=='weekly'||!state.cupMoves||state.cupMoves.length>500||state.phase!=='build'||state.completed>5)return;
    const candidate={week:state.challenge.id,ticks:state.tick,moves:state.cupMoves,waves:state.completed,lives:state.lives,cash:state.money};
    const old=read();
    if(old?.week===candidate.week){
      for(const field of ['waves','lives','cash']){
        if(old[field]>candidate[field])return;
        if(old[field]<candidate[field])break;
      }
    }
    try{localStorage.setItem(slot,JSON.stringify(candidate));}catch{}
  }
  async function request(action,record){
    const headers={'Content-Type':'application/json',apikey:key};
    if(action==='submit'){
      auth ||= window.CrystalSupabase.createClient(endpoint,key);
      const {data}=await auth.auth.getSession();
      if(!data.session||data.session.user.is_anonymous)throw Error('Sign in to Earnly, then return here to post your best.');
      headers.Authorization='Bearer '+data.session.access_token;
    }
    const payload=action==='submit'?{week:record.week,ticks:record.ticks,moves:record.moves,action}:{action};
    const result=await fetch(endpoint+'/functions/v1/patch-cup',{method:'POST',headers,body:JSON.stringify(payload)});
    const data=await result.json();
    if(!result.ok)throw Error(data.error||'Could not reach the Cup.');
    return data.entries;
  }
  return {record,read,finish,request};
})();
