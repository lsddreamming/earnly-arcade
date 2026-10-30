/* Bounce Run's fixed-step physics and reachable obstacle groups. Shared by web/native QA. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BounceRunEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const GROUND=349,JUMP=-9.6,STEP=1000/60;
  function speedFor(cleared){
    if(cleared<5)return 1.35+cleared*.16;
    if(cleared<10)return 2.9+(cleared-5)*.24;
    if(cleared<20)return 4.1+(cleared-10)*.22;
    if(cleared<35)return 6.3+(cleared-20)*.10;
    return Math.min(10,7.8+(cleared-35)*.045);
  }
  function flight(){
    let y=GROUND,vy=JUMP,t=0,first=0,last=0;
    while(t++<100){vy+=vy<0?.40:.46;y+=vy;if(y+6<=320){if(!first)first=t;last=t;}if(y>=GROUND)break;}
    return {first,last,land:t};
  }
  const arc=flight();
  function wave(cleared,random=Math.random){
    const speed=speedFor(cleared);
    // All members have one speed. Their entire collision span fits inside
    // the safe-height portion of one jump, with six ticks of timing slack.
    const maxSpan=Math.max(16,speed*(arc.last-arc.first-6)-20);
    const double=cleared>=10&&random()<.38;
    const count=double?2:1,gap=double?10:0;
    const desired=cleared<5?16+random()*7:26+random()*40;
    const width=Math.min(desired,(maxSpan-gap)/count);
    return {speed,obstacles:Array.from({length:count},(_,i)=>({x:390+i*(width+gap),w:width,speed})),
      // The next wave has at least a full jump + recovery before arrival,
      // even at maximum speed. Waves never catch up to each other.
      delay:Math.max(12,arc.land+14-300/speed)+random()*22};
  }
  function create(random=Math.random){
    const s={y:GROUND,vy:0,obstacles:[],distance:0,cleared:0,alive:true,buffer:0,wait:60,ticks:0,jumps:0,lands:0};
    function jump(){if(!s.alive)return false;s.buffer=7;if(s.y>=GROUND){s.vy=JUMP;s.buffer=0;s.jumps++;return true;}return false;}
    function step(){
      if(!s.alive)return;
      s.ticks++;s.distance+=.18;
      if(s.buffer>0){s.buffer--;if(s.y>=GROUND){s.vy=JUMP;s.buffer=0;s.jumps++;}}
      const falling=s.vy!==0||s.y<GROUND;
      s.vy+=s.vy<0?.40:.46;s.y+=s.vy;
      if(s.y>=GROUND){s.y=GROUND;s.vy=0;if(falling)s.lands++;}
      if(!s.obstacles.length){
        if(--s.wait<=0){const w=wave(s.cleared,random);s.obstacles=w.obstacles;s.wait=w.delay;}
      }
      for(const o of s.obstacles){o.x-=o.speed;}
      // Match visible spike tips, using a forgiving ball collision box.
      if(s.obstacles.some(o=>o.x<90&&o.x+o.w>70&&s.y+6>320)){s.alive=false;return;}
      s.obstacles=s.obstacles.filter(o=>{if(o.x+o.w<70){s.cleared++;return false;}return true;});
    }
    return {state:s,jump,step};
  }
  return {create,wave,speedFor,arc,STEP,GROUND};
});
