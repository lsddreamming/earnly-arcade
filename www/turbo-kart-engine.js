/* Original Earnly racer. Deterministic fixed-step driving; no rendering or reward side effects. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TurboKartEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const LAPS=3,LIMIT=90,WIDTH=104,DRIFT_THRESHOLDS=[.45,1.1,1.8];
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),wrap=(n,l)=>((n%l)+l)%l;
 const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
 const definitions=[
  {id:'harbor',name:'Sunset Harbor',tag:'COASTAL CUP',description:'Sweeping bends • seaside boardwalk',sky:['#54c6ef','#d5f5ff'],ground:'#61b968',road:'#54677b',curb:'#fc7886',accent:'#62ffe0',scene:'harbor',anchors:[[0,260],[-270,250],[-390,70],[-330,-180],[-140,-300],[80,-250],[300,-300],[390,-90],[260,60],[140,140]]},
  {id:'canyon',name:'Peachstone Pass',tag:'CANYON CUP',description:'Tight hairpins • desert arches',sky:['#ffae75','#ffebae'],ground:'#e9ad79',road:'#83657c',curb:'#ffe098',accent:'#ffd667',scene:'canyon',anchors:[[0,260],[-250,260],[-340,80],[-210,-60],[-380,-250],[-100,-340],[30,-170],[250,-300],[370,-90],[220,140]]},
  {id:'garden',name:'Starlight Gardens',tag:'MIDNIGHT CUP',description:'Flowing S-bends • glowing gardens',sky:['#17224f','#b985d8'],ground:'#348786',road:'#4c507f',curb:'#e0abff',accent:'#bbff8c',scene:'garden',anchors:[[0,260],[-250,240],[-360,30],[-240,-110],[-320,-290],[-80,-340],[100,-170],[320,-220],[370,30],[180,180]]}
 ];
 function buildTrack(def){const points=[];let length=0;const a=def.anchors;
  for(let i=0;i<a.length;i++)for(let j=0;j<64;j++){const b=a[(i+a.length-1)%a.length],c=a[i],d=a[(i+1)%a.length],e=a[(i+2)%a.length],t=j/64,p={};for(const [k,n]of [['x',0],['y',1]])p[k]=.5*(2*c[n]+(-b[n]+d[n])*t+(2*b[n]-5*c[n]+4*d[n]-e[n])*t*t+(-b[n]+3*c[n]-3*d[n]+e[n])*t*t*t);if(points.length)length+=Math.hypot(p.x-points.at(-1).x,p.y-points.at(-1).y);p.d=length;points.push(p);}
  length+=Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y);return {...def,points,length};
 }
 const courses=definitions.map(buildTrack);
 function sample(distance,offset=0,track=courses[0]){const d=wrap(distance,track.length),points=track.points;let lo=0,hi=points.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(points[m].d<=d)lo=m;else hi=m-1;}const a=points[lo],b=points[(lo+1)%points.length],span=(lo===points.length-1?track.length:b.d)-a.d,t=(d-a.d)/span,angle=Math.atan2(b.y-a.y,b.x-a.x);return {x:a.x+(b.x-a.x)*t-Math.sin(angle)*offset,y:a.y+(b.y-a.y)*t+Math.cos(angle)*offset,angle};}
 function curvature(d,track){return angleDiff(sample(d+12,0,track).angle,sample(d-12,0,track).angle)/24;}
 function create(course='harbor'){const track=courses.find(c=>c.id===course)||courses[0];return {track,time:0,ended:false,finished:false,place:5,coins:0,pickupCount:0,item:null,itemIndex:0,driftCharge:0,drifts:0,jumps:0,cutsTaken:0,wasDrifting:false,events:[],callout:'',calloutUntil:0,projectiles:[],hazards:[],effects:[],draft:0,
  racers:['YOU','PIP','NOVA','REMY','FERN'].map((name,i)=>({name,d:i?12+(4-i)*19:0,lane:i%2?22:-22,heading:0,steer:0,speed:0,boost:0,coinSurge:0,shield:0,slow:0,cooldown:0,item:null,itemIndex:i,charge:0,air:0,cutActive:false,lastCut:null,driftDirection:0,drifting:false,itemCooldown:3+i,finishTime:null,color:['#65f5dc','#ffc363','#cba6ff','#ff819e','#79c2ff'][i]})),
  pickups:Array.from({length:24},(_,i)=>({d:track.length*(.055+Math.floor(i/3)*.12),lane:[-30,0,30][i%3],type:Math.floor(i/3)%2===0?'item':'coin',takenLap:-1,takenBy:[-1,-1,-1,-1,-1]})),ramps:[{d:track.length*.19,lane:0},{d:track.length*.61,lane:24}],cuts:[{start:track.length*.33,end:track.length*.33+105,lane:-60},{start:track.length*.76,end:track.length*.76+105,lane:60}],pads:[{d:track.length*.27,lane:-26},{d:track.length*.69,lane:27}]};}
 const items={boost:{name:'Turbo Cell',icon:'↟',hint:'Speed burst'},shield:{name:'Prism Guard',icon:'⬡',hint:'Blocks attacks'},pulse:{name:'Sonic Bloom',icon:'◎',hint:'Slows nearby rivals'},bolt:{name:'Arc Bolt',icon:'ϟ',hint:'Chases a rival ahead'},slick:{name:'Ink Patch',icon:'◉',hint:'Trap behind you'}};
 function announce(s,text){s.callout=text;s.calloutUntil=s.time+1.6;s.events.push(text);}
 function hit(s,r,seconds){if(r.cooldown>0||r.finishTime!==null)return false;if(r.shield>0){r.shield=0;r.cooldown=.8;if(r===s.racers[0])announce(s,'PRISM GUARD · BLOCKED');return false;}r.slow=Math.max(r.slow,seconds);r.cooldown=1.3;if(r===s.racers[0])announce(s,'HIT! · KEEP RACING');return true;}
 function useItem(s,index=0){if(s.ended)return;const r=s.racers[index],item=index?r.item:s.item;if(!item||r.finishTime!==null)return;if(index)r.item=null;else s.item=null;
  if(item==='boost')r.boost=Math.max(r.boost,2.6);
  if(item==='shield')r.shield=6;
  if(item==='pulse'){for(const other of s.racers)if(other!==r&&Math.abs(other.d-r.d)<135)hit(s,other,2.1);s.effects.push({type:'pulse',d:r.d,lane:r.lane,life:.65});}
  if(item==='bolt'){const target=s.racers.map((v,i)=>({v,i})).filter(t=>t.i!==index&&t.v.finishTime===null&&t.v.d>r.d&&t.v.d-r.d<400).sort((a,b)=>a.v.d-b.v.d)[0];s.projectiles.push({d:r.d+12,lane:r.lane,owner:index,target:target?.i??-1,life:3.5});}
  if(item==='slick')s.hazards.push({d:r.d-14,lane:r.lane,owner:index,life:8});
  if(!index)announce(s,items[item].name.toUpperCase());
 }
 function rank(s,index=0){const p=s.racers[index];return 1+s.racers.filter(r=>r!==p&&(p.finishTime!==null?r.finishTime!==null&&r.finishTime<p.finishTime:r.finishTime!==null||r.d>p.d)).length;}
 function rewards(s){if(!s.ended||!s.finished)return 0;return [20,15,12,9,7][s.place-1]+Math.min(5,s.coins);}
 function score(s){return s.finished?(6-s.place)*1000+Math.max(0,Math.floor((LIMIT-s.time)*10)):0;}
 function tier(charge){return DRIFT_THRESHOLDS.filter(t=>charge>=t).length;}
 function chooseItem(s,index){const r=s.racers[index],place=rank(s,index),pool=place>=4?['boost','bolt','shield','pulse','boost']:place===1?['shield','slick','boost']:['bolt','pulse','boost','shield','slick'];return pool[(r.itemIndex++ + Math.floor(r.d/s.track.length))%pool.length];}
 // Same steering and grip model for every racer. AI anticipates bends, pickups and traffic.
 function aiInput(s,index){const r=s.racers[index],bend=curvature(r.d+42,s.track);let lane=clamp(bend*4500,-24,24);
  const pickup=s.pickups.find(q=>wrap(q.d-r.d,s.track.length)<90&&q.takenBy[index]!==Math.max(0,Math.floor(r.d/s.track.length))&&(q.type==='item'&&!r.item));if(pickup)lane=pickup.lane;
  for(const other of s.racers)if(other!==r&&other.d-r.d>0&&other.d-r.d<40&&Math.abs(other.lane-r.lane)<17)lane=clamp(other.lane+(r.lane>=other.lane?25:-25),-35,35);
  for(const h of s.hazards)if(h.d-r.d>0&&h.d-r.d<75&&Math.abs(h.lane-lane)<20)lane=h.lane>0?-26:26;
  const desired=clamp((lane-r.lane)*.017,-.38,.38),steer=clamp((desired-r.heading)*3.3+bend*r.speed/1.35,-1,1);
  if(r.item&&r.itemCooldown<=0){const ahead=s.racers.some(v=>v!==r&&v.d>r.d&&v.d-r.d<200);if(r.item==='shield'||r.item==='slick'||(r.item==='boost'&&Math.abs(bend)<.005)||(['bolt','pulse'].includes(r.item)&&ahead)){useItem(s,index);r.itemCooldown=5+index;}}
  return {steer,drift:Math.abs(bend)>.003&&Math.abs(r.lane)<33&&r.charge<1.5};
 }
 function tick(s,dt,input={}){if(s.ended||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);s.time+=dt;s.events=[];const p=s.racers[0],track=s.track;
  if(input.item)useItem(s);
  for(let i=0;i<s.racers.length;i++){const r=s.racers[i];if(r.finishTime!==null)continue;for(const k of ['boost','coinSurge','shield','slow','cooldown','itemCooldown'])r[k]=Math.max(0,r[k]-dt);
   const wasAir=r.air;r.air=Math.max(0,r.air-dt);if(wasAir>0&&r.air===0){r.boost=Math.max(r.boost,.8);if(!i)announce(s,'SMOOTH LANDING · BOOST');}
   const cut=s.cuts.find(c=>wrap(r.d,track.length)>=c.start&&wrap(r.d,track.length)<=c.end&&Math.abs(r.lane-c.lane)<9);
   const cutKey=cut?Math.floor(r.d/track.length)+':'+cut.start:null;if(cutKey&&cutKey!==r.lastCut&&!i){r.lastCut=cutKey;s.cutsTaken++;announce(s,'SHORTCUT · HOLD YOUR LINE');}r.cutActive=!!cut;
   const control=i?aiInput(s,i):input,steer=clamp(Number(control.steer)||0,-1,1),onRoad=Math.abs(r.lane)<WIDTH/2-5,bend=curvature(r.d,track);
   const drifting=!!control.drift&&(r.drifting||Math.abs(steer)>.12)&&r.speed>38&&onRoad&&r.slow===0;
   if(drifting&&!r.drifting)r.driftDirection=Math.sign(steer);
   // Countersteer adjusts the slide; only actually crossing into the opposite slide resets charge.
   if(drifting&&Math.abs(r.heading)>.1&&Math.sign(r.heading)!==r.driftDirection){r.charge=0;r.driftDirection=Math.sign(r.heading);}
   if(drifting&&Math.abs(r.heading)>.06)r.charge=Math.min(2.5,r.charge+dt);
   if(!drifting&&r.drifting){const level=tier(r.charge);if(level&&onRoad&&r.slow===0&&!control.drift){r.boost=Math.max(r.boost,[0,1.1,1.8,2.6][level]);if(!i){s.drifts++;announce(s,['','DRIFT BOOST','SUPER DRIFT','ULTRA DRIFT'][level]);}}r.charge=0;}
   r.drifting=drifting;r.steer+=(steer-r.steer)*Math.min(1,dt*12);
   if(!i&&!drifting){
    // Normal steering sets a direction rather than accumulating a slide.
    // A small curve force keeps corners meaningful without fighting the thumb.
    const desired=clamp(r.steer*.34-bend*r.speed*.12,-.45,.45);
    r.heading+=(desired-r.heading)*(1-Math.exp(-14*dt));
   }else{
    r.heading=clamp(r.heading+((drifting?r.steer*.72+r.driftDirection*.2:r.steer*1.35)-bend*r.speed)*dt,-.85,.85);r.heading*=Math.exp(-(drifting?1.45:1.9)*dt);
   }
   r.lane+=Math.sin(r.heading)*r.speed*dt;
   if(Math.abs(r.lane)>75){r.lane=clamp(r.lane,-75,75);r.heading*=.85;}
   const off=Math.abs(r.lane)>WIDTH/2-5&&!cut,base=i?111+i*.65:108,cornerSpeed=i?clamp(1-Math.abs(curvature(r.d+45,track))*12,.9,1):1;
   const target=base*cornerSpeed*(cut?1.3:1)*(off?.46:1)*(r.slow>0?.58:1)*(r.boost>0?1.42:r.coinSurge>0?1.12:1)*(drifting?.94:1);
   r.speed+=(target-r.speed)*Math.min(1,dt*(target<r.speed?3.2:2));const before=r.d;r.d+=r.speed*Math.max(.65,Math.cos(r.heading))*dt;
   if(!i&&Math.floor(r.d/track.length)>Math.floor(before/track.length)&&r.d<track.length*LAPS)announce(s,r.d>=track.length*2?'FINAL LAP!':'LAP 2 · KEEP PUSHING');
   if(r.d>=track.length*LAPS){r.finishTime=s.time-dt+(track.length*LAPS-before)/(r.d-before)*dt;r.d=track.length*LAPS;}
   for(const pick of s.pickups){const lap=Math.floor(before/track.length),next=lap*track.length+pick.d;if(before<=next&&r.d>=next&&Math.abs(r.lane-pick.lane)<16&&pick.takenBy[i]!==lap){pick.takenBy[i]=lap;if(!i)pick.takenLap=lap;if(pick.type==='coin'){r.coinSurge=.65;if(!i){s.pickupCount++;const earned=s.coins<5;s.coins=Math.min(5,s.coins+1);s.effects.push({type:'coin',d:r.d,lane:r.lane,life:.5});announce(s,earned?'+1 COIN · SPEED SURGE':'COIN SURGE · KEEP PUSHING');}}else if(pick.type==='item'&&!(i?r.item:s.item)){const item=chooseItem(s,i);if(i)r.item=item;else{s.item=item;announce(s,items[item].name.toUpperCase()+' READY');}}}}
   for(const ramp of s.ramps){const next=Math.floor(before/track.length)*track.length+ramp.d;if(before<=next&&r.d>=next&&Math.abs(r.lane-ramp.lane)<15&&r.speed>65&&r.air===0){r.air=.75;if(!i){s.jumps++;announce(s,'AIR TIME!');}}}
   for(const pad of s.pads){const next=Math.floor(before/track.length)*track.length+pad.d;if(before<=next&&r.d>=next&&Math.abs(r.lane-pad.lane)<19){r.boost=Math.max(r.boost,1.6);if(!i)announce(s,'BOOST STRIP');}}
  }
  for(const shot of s.projectiles){shot.life-=dt;const target=s.racers[shot.target];if(target&&target.finishTime===null)shot.lane+=clamp(target.lane-shot.lane,-85*dt,85*dt);const before=shot.d;shot.d+=205*dt;for(let i=0;i<s.racers.length;i++){const r=s.racers[i];if(i!==shot.owner&&r.d>=before-9&&r.d<=shot.d+9&&Math.abs(r.lane-shot.lane)<15){hit(s,r,1.9);shot.life=0;break;}}}
  for(const h of s.hazards){h.life-=dt;for(let i=0;i<s.racers.length;i++){const r=s.racers[i];if(i!==h.owner&&Math.abs(r.d-h.d)<12&&Math.abs(r.lane-h.lane)<17){hit(s,r,1.7);h.life=0;break;}}}
  s.projectiles=s.projectiles.filter(v=>v.life>0);s.hazards=s.hazards.filter(v=>v.life>0);s.effects=s.effects.filter(v=>(v.life-=dt)>0);
  // Contact separation never waits for damage immunity: karts stay solid during a bump.
  // Match the rendered 23-unit chassis width, resolve packs without changing race distance.
  for(let pass=0;pass<32;pass++){let contacts=false;for(let i=0;i<s.racers.length;i++)for(let j=i+1;j<s.racers.length;j++){
   const a=s.racers[i],b=s.racers[j];if(a.finishTime!==null||b.finishTime!==null)continue;
   if(Math.abs(a.d-b.d)<18&&Math.abs(a.lane-b.lane)<24){contacts=true;
    const direction=a.lane===b.lane?(i<j?-1:1):Math.sign(a.lane-b.lane),push=(24-Math.abs(a.lane-b.lane))/2+.01;
    const nextA=a.lane+direction*push,nextB=b.lane-direction*push;
    a.lane=clamp(nextA,-75,75);b.lane=clamp(nextB,-75,75);
    const remainder=Math.max(0,24.02-Math.abs(a.lane-b.lane));
    if(a.lane!==nextA)b.lane=clamp(b.lane-direction*remainder,-75,75);else if(b.lane!==nextB)a.lane=clamp(a.lane+direction*remainder,-75,75);
    if(!a.cooldown&&!b.cooldown){if(!a.shield)a.slow=.35;if(!b.shield)b.slow=.35;a.cooldown=b.cooldown=1;}
   }
  }
  if(!contacts)break;}
  const drafting=s.racers.slice(1).some(r=>r.d-p.d>16&&r.d-p.d<65&&Math.abs(r.lane-p.lane)<12)&&Math.abs(p.lane)<47&&p.speed>60;
  s.draft=drafting?s.draft+dt:Math.max(0,s.draft-dt*2);if(s.draft>1.1){p.boost=Math.max(p.boost,.8);s.draft=0;announce(s,'SLIPSTREAM');}
  s.driftCharge=p.charge;s.wasDrifting=p.drifting;s.place=rank(s);
  if(p.finishTime!==null||s.time>=LIMIT){s.ended=true;s.finished=p.finishTime!==null;s.time=s.finished?p.finishTime:LIMIT;s.place=rank(s);s.driftCharge=0;}
 }
 return {LAPS,LIMIT,WIDTH,DRIFT_THRESHOLDS,courses,items,length:courses[0].length,points:courses[0].points,sample,curvature,create,tick,useItem,rewards,score,rank,tier,aiInput};
});
