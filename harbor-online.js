(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  let live=false,busy=false,last=0,peers=[],run=null,queue=Promise.resolve(),generation=0,health=100,shotBusy=false,respawn=null,noticeUntil=0,liveEpoch=0;
  const client=()=>window.EarnlyCloud?.client;
  const status=text=>{el('online-status').textContent=text;const toast=el('live-notice');if(toast){toast.textContent=text;toast.hidden=false;toast.dataset.until=String(Date.now()+3500);}};
  async function rpc(name,args){if(!client())throw new Error('Connection unavailable'); const {data,error}=await client().rpc(name,args);if(error)throw error;return data;}
  async function signedIn(){const {data}=await client().auth.getSession();return Boolean(data.session);}
  function disconnect(){liveEpoch++;live=false;peers=[];health=100;el('live-health').hidden=true;el('connect-live').textContent='Connect Live';status('Solo free roam');rpc('harbor_live',{p_x:0,p_z:0,p_angle:0,p_leave:true}).catch(()=>{});}
  el('connect-live').addEventListener('click',async()=>{
    if(live){disconnect();return;}
    try {if(!await signedIn()){el('harbor-login').hidden=false;status('Sign in to your Earnly account to connect.');return;}
      liveEpoch++;live=true;last=0;el('connect-live').textContent='Disconnect';status('Connecting…');
    }catch{status('Connection unavailable. Try again.');}
  });
  el('harbor-login').addEventListener('submit',async event=>{
    event.preventDefault(); status('Signing in…');
    try{const {error}=await client().auth.signInWithPassword({email:el('harbor-email').value,password:el('harbor-password').value});el('harbor-password').value='';if(error)throw error;el('harbor-login').hidden=true;status('Signed in. Start a mission for coin rewards, or Connect Live.');}catch{status('Sign-in failed. Check your email and password.');}
  });
  window.addEventListener('pagehide',()=>{if(live)disconnect();});
  window.HarborOnline={
    peers:()=>peers.map(p=>{
      const t=Math.min(1,(Date.now()-p.received)/180);
      return {...p,x:p.fromX+(p.x-p.fromX)*t,z:p.fromZ+(p.z-p.fromZ)*t,angle:p.fromAngle+Math.atan2(Math.sin(p.angle-p.fromAngle),Math.cos(p.angle-p.fromAngle))*t};
    }),
    dead:()=>live&&health===0,
    takeRespawn(){const value=respawn;respawn=null;return value;},
    fire(angle,weapon){
      if(!live||health===0||shotBusy)return;shotBusy=true;const epoch=liveEpoch;
      rpc('harbor_fire',{p_angle:Math.atan2(Math.sin(angle),Math.cos(angle)),p_weapon:weapon}).then(hit=>{if(!live||epoch!==liveEpoch)return;if(hit.hit){status(hit.killed?'+'+hit.amount+' Arcade Coins · live player defeated!':'Live player hit · '+hit.health+' health remaining');noticeUntil=Date.now()+3500;}}).catch(()=>{status('Live shot not confirmed. Check your connection.');}).finally(()=>{shotBusy=false;});
    },
    tick(state){
      if(!live||busy||Date.now()-last<550)return;
      if(!state.free){disconnect();return;}
      busy=true;last=Date.now();const epoch=liveEpoch;
      rpc('harbor_live',{p_x:state.x,p_z:state.z,p_angle:Math.atan2(Math.sin(state.angle),Math.cos(state.angle)),p_driving:state.driving}).then(data=>{
        if(!live||epoch!==liveEpoch)return;
        const rows=data.peers;health=data.health ?? 100;
        el('live-health').hidden=false;el('live-health').textContent=health===0?'Defeated · respawning in '+data.respawnIn+'s':'Live health '+health+'/100'+(data.shield?' · Spawn protection':'');
        if(data.respawn)respawn={x:data.x,z:data.z};
        peers=Array.isArray(rows)?rows.filter(p=>[p.x,p.z,p.angle].every(Number.isFinite)).slice(0,15).map(p=>{const old=window.HarborOnline.peers().find(v=>v.id===p.id);const blend=old&&Math.hypot(old.x-p.x,old.z-p.z)<12;return {...p,fromX:blend?old.x:p.x,fromZ:blend?old.z:p.z,fromAngle:blend?old.angle:p.angle,received:Date.now()};}):[];
        if(Date.now()>noticeUntil)el('online-status').textContent='Live PvP · '+(peers.length+1)+' connected · 100 coins per player defeat';
      }).catch(()=>{if(epoch!==liveEpoch)return;liveEpoch++;live=false;peers=[];health=100;el('live-health').hidden=true;el('connect-live').textContent='Reconnect Live';status('Disconnected. Your solo game continues.');}).finally(()=>{busy=false;});
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
