(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PerfectDropEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const LEFT=28,RIGHT=332,RADIUS=12,STEP=1/120,FLIGHT=.52,HOLD=.46;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const zones=[{name:'Sky Dock',color:'#75e8ef',dark:'#174363'},{name:'Starlight Foundry',color:'#baadff',dark:'#2f315e'},{name:'Solar Heights',color:'#ffd17e',dark:'#453955'},{name:'Aurora Forge',color:'#8df1c9',dark:'#164c56'}];
 function zone(hits){return zones[Math.floor(hits/10)%zones.length];}
 function round(hits,random=Math.random,recent=[]){
  const speed=Math.min(300,145+hits*3),w=Math.max(76,152-hits*1.6,2*RADIUS+speed*1.12*.2);
  const lo=LEFT+w/2+8,hi=RIGHT-w/2-8;
  let center=180;
  if(hits||recent.length){for(let i=0;i<32;i++){center=lo+random()*(hi-lo);if(recent.every(x=>Math.abs(center-x)>22))break;}}
  const start=center>=180?LEFT:RIGHT,dir=start===LEFT?1:-1;
  return {center,w,speed,start,dir,type:hits>=10&&random()<.55?'PULSE':'STEADY',limit:Math.max(3.2,6.4-hits*.045,2*(RIGHT-LEFT)/(speed*.88)+.85)};
 }
 function position(r,time){
  const omega=2*Math.PI/1.6;
  const distance=r.speed*(time+(r.type==='PULSE'?.12*(1-Math.cos(time*omega))/omega:0));
  const span=RIGHT-LEFT,cycle=((distance%(2*span))+2*span)%(2*span),x=cycle<span?LEFT+cycle:RIGHT-(cycle-span);
  return r.dir===1?x:LEFT+RIGHT-x;
 }
 function landing(r,x){const delta=Math.abs(x-r.center),safe=r.w/2-RADIUS;return {hit:delta<=safe+1e-7,perfect:delta<=Math.max(8,r.w*.12)+1e-7};}
 function create({random=Math.random}={}){
  const state={phase:'aim',phaseTime:0,aimTime:0,time:0,ticks:0,hits:0,lives:3,attempts:0,perfects:0,streak:0,bestStreak:0,perfectChain:0,bestPerfectChain:0,x:LEFT,dropX:LEFT,fall:0,lastOutcome:'',flareUntil:0,round:null};
  let accumulator=0,pending=[],recent=[];
  function next(){state.round=round(state.hits,random,recent);recent.push(state.round.center);if(recent.length>2)recent.shift();state.phase='aim';state.phaseTime=state.aimTime=state.fall=0;state.x=state.round.start;}
  function settle(hit,perfect,timeout=false){
   state.attempts++;state.phase='feedback';state.phaseTime=0;
   if(hit){state.hits++;state.streak++;state.bestStreak=Math.max(state.bestStreak,state.streak);state.perfectChain=perfect?state.perfectChain+1:0;if(perfect)state.perfects++;state.bestPerfectChain=Math.max(state.bestPerfectChain,state.perfectChain);if(state.perfectChain>=3)state.flareUntil=state.time+1.4;}
   else{state.lives--;state.streak=state.perfectChain=0;}
   state.lastOutcome=hit?(perfect?'PERFECT':'CLEAN LANDING'):(timeout?'TOO LATE':'MISSED THE PAD');
   pending.push({type:hit?'hit':'miss',perfect,timeout,hits:state.hits,chain:state.perfectChain});
  }
  function commit(){
   if(state.phase!=='aim')return false;
   if(state.aimTime>=state.round.limit){settle(false,false,true);return false;}
   state.dropX=state.x;state.phase='flight';state.phaseTime=0;state.fall=0;pending.push({type:'release'});return true;
  }
  function advance(seconds){
   accumulator+=Math.max(0,Number(seconds)||0);
   while(accumulator+1e-9>=STEP){
    accumulator-=STEP;if(state.phase==='over')continue;
    state.ticks++;state.time+=STEP;state.phaseTime+=STEP;
    if(state.phase==='aim'){state.aimTime+=STEP;state.x=position(state.round,state.aimTime);if(state.aimTime+1e-9>=state.round.limit)settle(false,false,true);}
    else if(state.phase==='flight'){state.fall=clamp(state.phaseTime/FLIGHT,0,1)**2;if(state.phaseTime+1e-9>=FLIGHT){state.fall=1;const result=landing(state.round,state.dropX);settle(result.hit,result.perfect);}}
    else if(state.phase==='feedback'&&state.phaseTime+1e-9>=HOLD){if(state.lives<=0){state.phase='over';pending.push({type:'over'});}else next();}
   }
   const events=pending;pending=[];return events;
  }
  next();return {state,advance,commit};
 }
 return {create,round,position,landing,zone,LEFT,RIGHT,RADIUS,STEP,FLIGHT,HOLD};
});
