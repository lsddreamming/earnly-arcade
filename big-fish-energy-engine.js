/* Original BIG FISH ENERGY simulation. No DOM, wallet writes, or ambient RNG. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BigFishEnergy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const zones=[{name:'Coral Playground',size:.3},{name:'Open Ocean',size:1.5},{name:'Shark Territory',size:6},{name:'Deep Sea',size:24},{name:'Monster Waters',size:100},{name:'Endless Abyss',size:400}];
const MAX_FISH=96,TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const edible=(playerSize,fishSize)=>Number.isFinite(playerSize)&&Number.isFinite(fishSize)&&fishSize>0&&fishSize<playerSize;
function growthFor(size,prey){if(!edible(size,prey))return 0;return size*.095*Math.pow(prey/size,3.5);}
function zoneFor(size){let z=0;while(z<zones.length-1&&size>=zones[z+1].size)z++;return z;}
function turn(a,b,amount){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*amount;}
function create(options={}){
 let seed=(Number(options.seed)||1)>>>0,nextId=1;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const requestedMode=options.snapshot?.state?.mode||options.mode;
 const mode=['endless','timed','predator'].includes(requestedMode)?requestedMode:'endless';
 const s={mode,seed,player:{x:0,y:0,size:.3,angle:0,vx:0,vy:0,boost:1},fish:[],time:0,eaten:0,zone:0,dead:false,won:false,paused:false,events:[],remaining:mode==='timed'?180:Infinity,boosting:false,bosses:0,peakSize:.3};
 let bossAt=22,schoolClock=0;
 const emit=e=>{s.events.push(e);if(s.events.length>128)s.events.shift();};
 function spawn(initial=false,boss=false){
  const p=s.player,roll=random();let a=random()*TAU;
  // Each creature keeps its original size for its entire lifetime. The population
  // widens with the camera, but growing never turns an edible creature dangerous.
  const ratio=boss?1.45+random()*.3:roll<.18?.12+random()*.2:roll<(s.zone<2?.91:.86)?.38+random()*.55:1.12+random()*1.6;
  const size=p.size*ratio,prey=edible(p.size,size),school=prey?Math.floor(random()*7):-1;
  if(initial&&prey)a=school*TAU/7+(random()-.5)*.5;
  const r=p.size*(initial?(prey?3+(school%3)*2+random()*2:14+random()*7):12+random()*5);
  const kind=size<1?'tropical':size<4?'tuna':size<9?'barracuda':size<24?'shark':size<70?(random()<.5?'squid':'angler'):'leviathan';
  const f={id:nextId++,x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r,size,angle:a+Math.PI,vx:0,vy:0,kind,hue:kind==='tropical'?Math.floor(random()*360):[185,205,270,325][Math.floor(random()*4)],school,boss,phase:random()*TAU,temper:random(),born:s.time,behavior:'cruise'};
  s.fish.push(f);return f;
 }
 if(options.snapshot){
  // Checkpoints are trusted server-generated data, never accepted from a client.
  const saved=JSON.parse(JSON.stringify(options.snapshot));
  if(saved.version!==1||!saved.state||!Number.isFinite(saved.rng)||!Number.isFinite(saved.nextId)||!Number.isFinite(saved.bossAt)||!Number.isFinite(saved.schoolClock))throw new Error('Invalid Big Fish checkpoint');
  Object.assign(s,saved.state);s.events=[];s.remaining=mode==='timed'?Math.max(0,180-s.time):Infinity;
  seed=saved.rng>>>0;nextId=saved.nextId;bossAt=saved.bossAt;schoolClock=saved.schoolClock;
 }else {
  for(let i=0;i<MAX_FISH;i++)spawn(true);
  // A small welcome shoal offers a readable first bite without a free collision.
  // These fish still need to be chased; they merely react more gently at first.
  for(let i=0;i<3;i++){const f=s.fish[i],a=[-.5,0,.5][i];
   Object.assign(f,{x:Math.cos(a)*(.3+i*.065),y:Math.sin(a)*(.3+i*.065),size:.3*[.74,.82,.9][i],angle:0,kind:'tropical',hue:[42,174,315][i],school:0,welcome:true});}
 }

 function tick(dt,input){
  const p=s.player;s.time+=dt;s.remaining=mode==='timed'?Math.max(0,180-s.time):Infinity;
  const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,len=Math.hypot(ix,iy),moving=len>.001;
  s.boosting=!!input.boost&&moving&&p.boost>.025;
  p.boost=clamp(p.boost+(s.boosting?-.34:.16)*dt,0,1);
  const speed=p.size*(s.boosting?5.5:3.15),gain=1-Math.exp(-9*dt),dx=moving?ix/Math.max(1,len):0,dy=moving?iy/Math.max(1,len):0;
  p.vx+=(dx*speed-p.vx)*gain;p.vy+=(dy*speed-p.vy)*gain;
  if(moving)p.angle=turn(p.angle,Math.atan2(dy,dx),1-Math.exp(-10*dt));
  p.x+=p.vx*dt;p.y+=p.vy*dt;
  schoolClock+=dt;
  const schools=Array.from({length:7},()=>({x:0,y:0,n:0}));
  for(const f of s.fish)if(f.school>=0){const group=schools[f.school];group.x+=f.x;group.y+=f.y;group.n++;}
  for(let i=s.fish.length-1;i>=0;i--){
   const f=s.fish[i],rx=p.x-f.x,ry=p.y-f.y,d=Math.hypot(rx,ry),isPrey=edible(p.size,f.size),near=d<p.size*4;
   let heading=f.angle,npcSpeed=Math.max(f.size,p.size*.32)*(isPrey?.9:.65);
   if(isPrey&&near){heading=Math.atan2(-ry,-rx);npcSpeed=p.size*(f.size/p.size>.65?1.45:1.05)*(f.welcome&&s.time<4?.35:1);f.behavior='flee';}
   else if(!isPrey&&d<Math.max(p.size*6,f.size*3)&&s.time>4&&(f.boss||Math.sin(s.time*.24+f.phase)>.15)){heading=Math.atan2(ry,rx);npcSpeed=p.size*(f.boss?2.65:1.8);f.behavior='hunt';}
   else {heading=f.school>=0?f.school*.86+Math.sin(schoolClock*.3+f.school)*.55:f.angle+Math.sin(s.time*.6+f.phase)*dt*.4;
    if(f.school>=0){const group=schools[f.school],sx=group.x/group.n-f.x,sy=group.y/group.n-f.y;
     if(Math.hypot(sx,sy)>p.size*1.4)heading=turn(heading,Math.atan2(sy,sx),.45);}
    f.behavior='cruise';}
   f.angle=turn(f.angle,heading,1-Math.exp(-(isPrey?2.6:1.25)*dt));
   f.vx=Math.cos(f.angle)*npcSpeed;f.vy=Math.sin(f.angle)*npcSpeed;f.x+=f.vx*dt;f.y+=f.vy*dt;
   // Capsule-like ellipse overlap with conservative radii: the drawn tails do not
   // kill a player. Small fixed substeps prevent boosted movement tunnelling.
   const cx=p.x-f.x,cy=p.y-f.y,along=cx*Math.cos(f.angle)+cy*Math.sin(f.angle),across=-cx*Math.sin(f.angle)+cy*Math.cos(f.angle);
   const hit=(along/((p.size+f.size)*.36))**2+(across/((p.size+f.size)*.19))**2<1;
   if(hit){
    if(isPrey){const growth=growthFor(p.size,f.size);p.size+=growth;s.peakSize=p.size;s.eaten++;if(f.boss)s.bosses++;emit({type:'eat',x:f.x,y:f.y,size:f.size,growth,boss:f.boss});s.fish.splice(i,1);continue;}
    if(s.time>4){s.dead=true;emit({type:'death',x:p.x,y:p.y,kind:f.kind,size:f.size});return;}
   }
   if(d>p.size*23||f.size<p.size*.018)s.fish.splice(i,1);
  }
  const zone=zoneFor(p.size);if(zone!==s.zone){s.zone=zone;emit({type:'zone',zone,name:zones[zone].name});}
  if(mode==='predator'&&s.time>=bossAt){if(s.fish.length>=MAX_FISH)s.fish.shift();spawn(false,true);bossAt+=28;emit({type:'boss',wave:Math.floor(bossAt/28)});}
  while(s.fish.length<MAX_FISH)spawn();
  if(mode==='timed'&&s.remaining<=0){s.won=true;emit({type:'win'});}
 }
 function step(dt,input={}){
  if(s.paused||s.dead||s.won||!Number.isFinite(dt)||dt<=0)return s;
  // The caller may use elapsed time; long background gaps are never simulated.
  let remaining=Math.min(.25,dt);while(remaining>1e-8&&!s.dead&&!s.won){const chunk=Math.min(1/60,remaining);tick(chunk,input);remaining-=chunk;}
  return s;
 }
 function snapshot(){return {mode:s.mode,time:s.time,size:s.player.size,eaten:s.eaten,zone:s.zone,bosses:s.bosses,dead:s.dead,won:s.won,seed:s.seed};}
 function exportState(){const state=JSON.parse(JSON.stringify(s));state.events=[];return {version:1,state,rng:seed,nextId,bossAt,schoolClock};}
 return {state:s,step,snapshot,exportState};
}
return {create,zones,edible,growthFor,zoneFor,MAX_FISH};
});
