(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  let live=false,busy=false,last=0,peers=[],run=null,queue=Promise.resolve(),generation=0;
  const client=()=>window.EarnlyCloud?.client;
  const status=text=>{el('online-status').textContent=text;};
  async function rpc(name,args){if(!client())throw new Error('Connection unavailable'); const {data,error}=await client().rpc(name,args);if(error)throw error;return data;}
  async function signedIn(){const {data}=await client().auth.getSession();return Boolean(data.session);}
  function disconnect(){live=false;peers=[];el('connect-live').textContent='Connect Live';status('Solo free roam');rpc('harbor_live',{p_x:0,p_z:0,p_angle:0,p_leave:true}).catch(()=>{});}
  el('connect-live').addEventListener('click',async()=>{
    if(live){disconnect();return;}
    try {if(!await signedIn()){el('harbor-login').hidden=false;status('Sign in to your Earnly account to connect.');return;}
      live=true;last=0;el('connect-live').textContent='Disconnect';status('Connecting…');
    }catch{status('Connection unavailable. Try again.');}
  });
  el('harbor-login').addEventListener('submit',async event=>{
    event.preventDefault(); status('Signing in…');
    try{const {error}=await client().auth.signInWithPassword({email:el('harbor-email').value,password:el('harbor-password').value});el('harbor-password').value='';if(error)throw error;el('harbor-login').hidden=true;status('Signed in. Start a mission for coin rewards, or Connect Live.');}catch{status('Sign-in failed. Check your email and password.');}
  });
  window.addEventListener('pagehide',()=>{if(live)disconnect();});
  window.HarborOnline={
    peers:()=>peers,
    tick(state){
      if(!live||busy||Date.now()-last<550)return;
      if(!state.free){disconnect();return;}
      busy=true;last=Date.now();
      rpc('harbor_live',{p_x:state.x,p_z:state.z,p_angle:Math.atan2(Math.sin(state.angle),Math.cos(state.angle)),p_driving:state.driving}).then(rows=>{
        if(!live)return;
        peers=Array.isArray(rows)?rows.filter(p=>[p.x,p.z,p.angle].every(Number.isFinite)).slice(0,15):[];
        status('Live free roam · '+(peers.length+1)+' connected · shared players, local traffic');
      }).catch(()=>{live=false;peers=[];el('connect-live').textContent='Reconnect Live';status('Disconnected. Your solo game continues.');}).finally(()=>{busy=false;});
    },
    start(mission){
      const current=++generation;run=null;queue=Promise.resolve();
      if(mission===null)return;
      queue=(async()=>{if(!client()||!await signedIn()){status('Sign in before starting a mission to earn Arcade Coins.');return;}const data=await rpc('harbor_mission',{p_action:'start',p_mission:mission});if(current===generation){run=data;status('Mission reward: '+data.reward+' Arcade Coins on first completion.');}})().catch(()=>{status('Reward tracking unavailable. Restart the mission when connected.');});
    },
    stage(stage,x,z){const current=generation;queue=queue.then(async()=>{if(current!==generation||!run)return;await rpc('harbor_mission',{p_action:'stage',p_token:run.token,p_stage:stage,p_x:x,p_z:z});}).catch(()=>{run=null;status('Mission could not be verified. No coins were claimed.');});},
    finish(){const current=generation;queue=queue.then(async()=>{if(current!==generation||!run)return;const reward=await rpc('harbor_mission',{p_action:'claim',p_token:run.token});status(reward.amount?'+'+reward.amount+' Arcade Coins added to your account!':'First-completion reward already claimed.');run=null;}).catch(()=>{status('Reward claim failed. Check your connection.');});}
  };
})();
