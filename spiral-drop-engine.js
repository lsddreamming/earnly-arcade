(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SpiralDropEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const WIDTH=360,RADIUS=11,THICKNESS=18,SPACING=180,KEY_SPEED=360,FIXED=1/120;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const zones=[{name:'Prism Well',color:'#59e5ef',dark:'#123653'},{name:'Amethyst Vault',color:'#bd9aff',dark:'#2c2452'},{name:'Solar Core',color:'#ffd080',dark:'#493343'},{name:'Aurora Deep',color:'#79f3be',dark:'#123e45'}];
  function zone(score){return zones[Math.floor(score/25)%zones.length];}
  function width(index){return index===0?140:Math.max(68,128-index*.75);}
  function speed(score){return Math.min(178,88+score*1.6);}
  function nextGap(index,recent,random=Math.random){
    if(!index)return 180;
    const w=width(index),lo=28+w/2,hi=WIDTH-lo,prev=recent.at(-1);
    const candidates=[];
    const valid=(v,strict=true)=>{
      const distance=Math.abs(v-prev);
      if(distance<(index===1?w/2+8:34)||distance>130)return false;
      // No fixed horizontal position may fit through three consecutive gaps.
      // The opening is generous, but standing still must never earn Coins.
      if(recent.length>1){
        const a=recent.at(-2),sa=width(index-2)/2-RADIUS,sb=width(index-1)/2-RADIUS;
        const loCommon=Math.max(a-sa,prev-sb),hiCommon=Math.min(a+sa,prev+sb),safe=w/2-RADIUS;
        if(loCommon<=hiCommon&&v-safe<=hiCommon&&v+safe>=loCommon)return false;
      }
      if(strict&&recent.length>1&&Math.abs(v-recent.at(-2))<22)return false;
      if(strict&&recent.length>2&&Math.abs(v-recent.at(-3))<18)return false;
      return true;
    };
    for(let i=0;i<48;i++){
      const v=lo+random()*(hi-lo);if(valid(v))candidates.push(v);
    }
    if(candidates.length)return candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
    // Use a bounded search if a random source repeatedly returns one value.
    for(let i=0;i<=64;i++){const v=lo+(hi-lo)*i/64;if(valid(v,false))candidates.push(v);}
    if(candidates.length)return candidates[Math.floor(candidates.length/2)];
    return clamp(prev+(prev<(lo+hi)/2?1:-1)*Math.min(80,(hi-lo)*.55),lo,hi);
  }
  function create({random=Math.random}={}){
    const state={x:180,y:0,vy:0,time:0,ticks:0,wait:.55,score:0,alive:true,endAge:0,rows:[],centered:0,streak:0,bestStreak:0,flowUntil:0,spin:0,lastClear:-10};
    let accumulator=0,index=0,recent=[];
    function append(){const gap=nextGap(index,recent,random);state.rows.push({id:index,y:150+index*SPACING,gap,w:width(index),passed:false});recent.push(gap);if(recent.length>5)recent.shift();index++;}
    for(let i=0;i<7;i++)append();
    function fail(events){if(!state.alive)return;state.alive=false;state.endAge=0;events.push({type:'crash',x:state.x,y:state.y});}
    function moveTo(x){
      if(!state.alive)return;
      const next=clamp(x,24,336);
      // A drag cannot move the sphere through a solid platform while it overlaps.
      for(const row of state.rows)if(!row.passed&&state.y+RADIUS>=row.y&&state.y-RADIUS<=row.y+THICKNESS&&Math.abs(next-row.gap)>row.w/2-RADIUS)return;
      state.spin+=(next-state.x)/RADIUS;state.x=next;
    }
    function tick(axis,events){
      state.ticks++;state.time+=FIXED;
      if(!state.alive){state.endAge+=FIXED;return;}
      const x0=state.x,y0=state.y;
      state.x=clamp(state.x+clamp(axis,-1,1)*KEY_SPEED*FIXED,24,336);
      state.spin+=(state.x-x0)/RADIUS;
      if(state.wait>0){state.wait=Math.max(0,state.wait-FIXED);return;}
      state.vy=Math.min(speed(state.score),state.vy+220*FIXED);
      state.y+=state.vy*FIXED;
      const dy=state.y-y0,dx=state.x-x0;
      for(const row of state.rows){
        if(row.passed||state.y+RADIUS<row.y||y0-RADIUS>row.y+THICKNESS)continue;
        // Sweep the entire sphere through the slab, not just one sampled frame.
        const enter=clamp((row.y-RADIUS-y0)/dy,0,1),exit=clamp((row.y+THICKNESS+RADIUS-y0)/dy,0,1),safe=row.w/2-RADIUS;
        if(Math.abs(x0+dx*enter-row.gap)>safe+1e-7||Math.abs(x0+dx*exit-row.gap)>safe+1e-7){state.y=Math.min(state.y,row.y-RADIUS);fail(events);return;}
        if(state.y-RADIUS>row.y+THICKNESS){
          row.passed=true;state.score++;state.lastClear=state.time;
          const centered=Math.abs(state.x-row.gap)<=Math.min(12,safe*.34);
          state.streak=centered?state.streak+1:0;
          if(centered)state.centered++;
          state.bestStreak=Math.max(state.bestStreak,state.streak);
          if(state.streak>=3)state.flowUntil=state.time+2.2;
          events.push({type:'clear',centered,flow:state.streak>=3,x:row.gap,y:row.y,score:state.score});
        }
      }
      while(state.rows.length&&state.rows[0].y<state.y-220)state.rows.shift();
      while(state.rows.length<7)append();
    }
    function advance(seconds,axis=0){
      const events=[];accumulator+=Math.max(0,Number(seconds)||0);
      while(accumulator+1e-9>=FIXED){tick(axis,events);accumulator-=FIXED;}
      return events;
    }
    return {state,advance,moveTo,dragBy:dx=>moveTo(state.x+dx)};
  }
  return {create,zone,width,speed,nextGap,WIDTH,RADIUS,THICKNESS,SPACING,KEY_SPEED,FIXED};
});
