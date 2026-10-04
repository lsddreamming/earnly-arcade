/* Deterministic, DOM-free Neon Drift simulation. Units are road pixels / seconds. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NeonDriftEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const DURATION=90, PLAYER_Y=410;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function road(z){return 200+46*Math.sin(z/510)+19*Math.sin(z/213);}
  function difficulty(time){const stage=Math.min(5,1+Math.floor(time/18));return {stage,speed:290+Math.min(210,time*2.6),halfWidth:128-Math.min(18,time*.2),interval:1.35-Math.min(.43,time*.006),pairs:time>=12};}
  function create(random=Math.random){return {random,time:0,distance:0,x:road(0),vx:0,hull:3,hurt:0,score:0,points:0,drift:0,nearMisses:0,combo:1,comboTime:0,bestCombo:1,traffic:[],spawnIn:1.1,ended:false,events:[],stage:1,skids:[],trailIn:0};}
  function event(s,type,data={}){s.events.push({type,...data});if(s.events.length>24)s.events.shift();}
  function hit(s){if(s.hurt>0||s.ended)return;s.hull--;s.hurt=1.5;s.combo=1;s.comboTime=0;s.vx*=.3;event(s,'crash');if(s.hull<=0)s.ended=true;}
  function spawn(s,d){
    // At most two cars per row: every formation has a full-width escape lane.
    // Match speeds within a pair so its opening cannot close as the player approaches.
    const lanes=[-1,0,1],gap=Math.floor(s.random()*3);const count=d.pairs&&s.random()<Math.min(.78,.48+s.time*.004)?2:1;
    const available=lanes.filter((_,i)=>i!==gap);if(s.random()<.5)available.reverse();
    const z=s.distance+560,pace=65+s.random()*20;
    for(let i=0;i<count;i++)s.traffic.push({z,lane:available[i],speed:pace,passed:false,close:Infinity,color:Math.floor(s.random()*3)});
  }
  function step(s,dt,steer){
    s.time=Math.min(DURATION,s.time+dt);const d=difficulty(s.time);
    if(d.stage!==s.stage){s.stage=d.stage;event(s,'stage',{stage:s.stage});}
    s.hurt=Math.max(0,s.hurt-dt);s.comboTime=Math.max(0,s.comboTime-dt);if(!s.comboTime)s.combo=1;
    s.vx+=(steer*260-s.vx)*(1-Math.exp(-dt*(steer?4.8:3.8)));
    s.x+=s.vx*dt;s.distance+=d.speed*dt;
    const center=road(s.distance),limit=d.halfWidth-14;
    if(Math.abs(s.x-center)>limit){hit(s);s.x=clamp(s.x,center-limit,center+limit);s.vx*=.4;}
    if(s.ended)return;
    const drifting=Math.abs(s.vx)>48&&s.hurt===0;
    if(drifting){s.drift+=dt;s.points+=dt*12*s.combo;}
    s.points+=dt*7;
    s.trailIn-=dt;
    if(drifting&&s.trailIn<=0){s.trailIn=.04;s.skids.push({x:s.x,z:s.distance-15,a:Math.atan2(s.vx,d.speed)});}
    s.skids=s.skids.filter(p=>s.distance-p.z<560).slice(-140);
    s.spawnIn-=dt;if(s.spawnIn<=0){spawn(s,d);s.spawnIn=d.interval+.25*s.random();}
    for(const car of s.traffic){
      car.z+=car.speed*dt;const dz=car.z-s.distance;
      const dx=Math.abs(s.x-(road(car.z)+car.lane*72));
      if(Math.abs(dz)<37){car.close=Math.min(car.close,dx);if(dx<25){car.passed=true;hit(s);if(s.ended)break;}}
      if(dz< -40&&!car.passed){car.passed=true;if(car.close>=25&&car.close<53&&s.hurt===0){s.nearMisses++;s.combo=Math.min(5,s.comboTime>0?s.combo+1:2);s.comboTime=5;s.bestCombo=Math.max(s.bestCombo,s.combo);s.points+=60*s.combo;event(s,'near',{combo:s.combo});}}
    }
    s.traffic=s.traffic.filter(car=>car.z>s.distance-150);
    s.score=Math.floor(s.points);
    if(s.time>=DURATION){s.ended=true;event(s,'complete');}
  }
  function tick(s,dt,steer=0){
    if(s.ended||!Number.isFinite(dt)||dt<=0)return;
    steer=Number.isFinite(steer)?clamp(steer,-1,1):0;
    // Bound background catch-up and substep collision checks on slow devices.
    let left=Math.min(.1,dt);while(left>1e-8&&!s.ended){const part=Math.min(1/120,left);step(s,part,steer);left-=part;}
  }
  return {DURATION,PLAYER_Y,road,difficulty,create,tick};
});
