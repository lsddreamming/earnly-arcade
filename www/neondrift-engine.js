/* Deterministic, DOM-free Neon Drift simulation. Units are road pixels / seconds. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NeonDriftEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const DURATION=90, PLAYER_Y=410, SECTORS=6, SECTOR_SECONDS=15;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function road(z){return 200+46*Math.sin(z/510)+19*Math.sin(z/213);}
  function difficulty(time){const stage=Math.min(SECTORS,1+Math.floor(time/SECTOR_SECONDS));return {stage,speed:350+Math.min(290,time*3.4),halfWidth:128-Math.min(18,time*.2),interval:1.2-Math.min(.42,time*.005),pairs:time>=10};}
  function create(random=Math.random){return {random,time:0,distance:0,x:road(0),vx:0,hull:3,hurt:0,score:0,points:0,drift:0,nearMisses:0,combo:1,comboTime:0,bestCombo:1,traffic:[],spawnIn:1.1,ended:false,events:[],stage:1,skids:[],trailIn:0,pickups:[],pickupIn:2,cores:0,coreStreak:0,bonusCoins:0,boost:0,sectorClean:true,cleanSectors:0};}
  function event(s,type,data={}){s.events.push({type,...data});if(s.events.length>24)s.events.shift();}
  function hit(s){if(s.hurt>0||s.ended)return;s.hull--;s.coreStreak=0;s.boost=0;s.sectorClean=false;s.hurt=1.5;s.combo=1;s.comboTime=0;s.vx*=.3;event(s,'crash');if(s.hull<=0)s.ended=true;}
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
    if(d.stage!==s.stage){const bonus=s.sectorClean?2:0;s.cleanSectors+=s.sectorClean?1:0;s.bonusCoins=Math.min(20,s.bonusCoins+bonus);s.sectorClean=true;s.stage=d.stage;event(s,'stage',{stage:s.stage,bonus});}
    s.boost=Math.max(0,s.boost-dt);
    s.hurt=Math.max(0,s.hurt-dt);s.comboTime=Math.max(0,s.comboTime-dt);if(!s.comboTime)s.combo=1;
    s.vx+=(steer*260-s.vx)*(1-Math.exp(-dt*(steer?4.8:3.8)));
    s.x+=s.vx*dt;s.distance+=d.speed*(s.boost>0?1.12:1)*dt;
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
    // Collectible Coins live on the same curved road as traffic. Prefer an open
    // lane with no car close to the pickup, and never spawn a blocked reward.
    s.pickupIn-=dt;
    if(s.pickupIn<=0){
      const z=s.distance+520;
      const safe=[-1,0,1].filter(lane=>s.traffic.every(c=>c.lane!==lane||Math.abs(c.z-z)>125));
      if(safe.length)s.pickups.push({z,lane:safe[Math.floor(s.random()*safe.length)],taken:false});
      s.pickupIn=2.8+s.random()*.6;
    }
    for(const pickup of s.pickups){
      const dz=pickup.z-s.distance,dx=Math.abs(s.x-(road(pickup.z)+pickup.lane*72));
      if(!pickup.taken&&Math.abs(dz)<26&&dx<26&&s.hurt===0){
        pickup.taken=true;s.cores++;s.coreStreak++;s.bonusCoins=Math.min(20,s.bonusCoins+1);s.points+=35;
        event(s,'pickup',{streak:s.coreStreak});
        if(s.coreStreak===5){s.coreStreak=0;s.boost=4;s.bonusCoins=Math.min(20,s.bonusCoins+2);event(s,'boost');}
      }else if(!pickup.taken&&dz< -30){pickup.taken=true;s.coreStreak=0;}
    }
    s.pickups=s.pickups.filter(p=>p.z>s.distance-100&&!p.taken).slice(-4);
    s.score=Math.floor(s.points);
    if(s.time>=DURATION){if(s.sectorClean){s.cleanSectors++;s.bonusCoins=Math.min(20,s.bonusCoins+2);}s.ended=true;event(s,'complete');}
  }
  function tick(s,dt,steer=0){
    if(s.ended||!Number.isFinite(dt)||dt<=0)return;
    steer=Number.isFinite(steer)?clamp(steer,-1,1):0;
    // Bound background catch-up and substep collision checks on slow devices.
    let left=Math.min(.1,dt);while(left>1e-8&&!s.ended){const part=Math.min(1/120,left);step(s,part,steer);left-=part;}
  }
  function rewards(s){const base=Math.min(25,Math.floor(Math.max(0,s.score)/100)),bonus=Math.min(20,Math.max(0,s.bonusCoins));return {base,bonus,total:base+bonus};}
  return {DURATION,PLAYER_Y,SECTORS,SECTOR_SECONDS,road,difficulty,create,tick,rewards};
});
