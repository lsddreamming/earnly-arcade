/* Metal Mayhem: deterministic 30 Hz combat. No DOM, wallet writes, or random clocks.
 * The same segment and blade poses drive both collision and the 3D renderer. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.MetalMayhem=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION=1,DT=1/30,TAU=Math.PI*2,BOUND=18.2;
 const OBSTACLES=[{x:-7,z:-6,r:1.55},{x:7,z:-6,r:1.55},{x:-7,z:6,r:1.55},{x:7,z:6,r:1.55}];
 const TYPES={
  blade:{name:'Scrapper',speed:2.8,hp:1,damage:18,reach:2.4,windup:.8,color:0xff7755,score:100},
  speed:{name:'Skitter',speed:4.7,hp:.75,damage:13,reach:2.25,windup:.48,color:0xba8cff,score:160},
  hammer:{name:'Foundry',speed:2.1,hp:1.8,damage:34,reach:2.8,windup:1.15,color:0xffb64c,score:220},
  archer:{name:'Longshot',speed:2.5,hp:.8,damage:16,reach:12,windup:1.1,color:0xff59a5,score:180},
  armored:{name:'Bulwark',speed:2.4,hp:1.45,damage:23,reach:2.5,windup:.85,color:0x67dfbd,score:260},
  giant:{name:'THE CRUCIBLE',speed:2,hp:4,damage:40,reach:4,windup:1.25,color:0xff493c,score:1200}
 };
 const UPGRADES=[
  {id:'edge',name:'Plasma edge',desc:'+22% blade damage. Cut through limbs faster.',icon:'⚔',max:Infinity},
  {id:'tempo',name:'Quick hands',desc:'12% faster swings and recovery.',icon:'»',max:5},
  {id:'armor',name:'Reinforced chassis',desc:'+25 maximum core armor. Restore all limbs.',icon:'⬡',max:Infinity},
  {id:'speed',name:'Overclock',desc:'+10% running speed. Keep the flank.',icon:'ϟ',max:5},
  {id:'dodge',name:'Phase drive',desc:'Longer dodges, lower energy cost.',icon:'↗',max:4},
  {id:'regen',name:'Power cell',desc:'+25% energy regeneration.',icon:'↻',max:5},
  {id:'force',name:'Impact amplifier',desc:'+35% knockback and longer stagger.',icon:'✦',max:5},
  {id:'repair',name:'Full rebuild',desc:'Restore every segment and refill energy.',icon:'+',max:Infinity},
  {id:'pulse',name:'Shock landing',desc:'Jump attacks release a stunning pulse.',icon:'◎',max:3}
 ];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const bearing=(a,b)=>Math.atan2(b.x-a.x,-(b.z-a.z));
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 function random(s){let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
 function local(a,x,y,z){const c=Math.cos(a.yaw),s=Math.sin(a.yaw),k=a.scale;return {x:a.x+(x*c-z*s)*k,y:a.y+y*k,z:a.z+(x*s+z*c)*k};}
 function actor(id,type,x,z,wave=1){
  const t=TYPES[type]||TYPES.blade,scale=type==='giant'?1.85:type==='hammer'?1.15:1;
  const hp=type==='player'?1:t.hp*(1+(wave-1)*.035);
  const max={core:Math.round((type==='player'?120:62)*hp),head:Math.round(35*hp),leftArm:Math.round(27*hp),rightArm:Math.round(27*hp),leftLeg:Math.round(32*hp),rightLeg:Math.round(32*hp)};
  return {id,type,x,z,y:0,vy:0,vx:0,vz:0,yaw:0,scale,hp:{...max},max,armor:type==='armored'||type==='giant'?{core:30*hp,head:18*hp,leftArm:12*hp,rightArm:12*hp}: {},alive:true,attack:null,cooldown:.7,stagger:0,dodge:0,invulnerable:0,block:false,parry:0,blockWas:false,telegraph:0,phase:0,walk:0,path:[],repath:0,combo:0,hitFlash:0,spawn:0};
 }
 function segments(a){
  const legs=Number(a.hp.leftLeg>0)+Number(a.hp.rightLeg>0),crouch=legs===0?-.82:legs===1?-.22:0;
  const stride=Math.sin(a.walk)*.18*(a.dodge?0:1);
  const data=[['core',0,1.3+crouch,0,.42],['head',0,1.94+crouch,-.03,.29],['leftArm',-.61,1.34+crouch,stride,.24],['rightArm',.61,1.34+crouch,-stride,.24],['leftLeg',-.25,.5, stride,.27],['rightLeg',.25,.5,-stride,.27]];
  return data.filter(([n])=>a.hp[n]>0).map(([name,x,y,z,r])=>({name,...local(a,x,y,z),r:r*a.scale}));
 }
 function blade(a,progress){
  const atk=a.attack,p=progress===undefined?(atk?atk.elapsed/atk.duration:0):progress;
  const mode=atk?atk.mode:0,reverse=mode===1?-1:1;
  const arm=a.hp.rightArm>0?1:-1;
  const crouch=a.hp.leftLeg<=0&&a.hp.rightLeg<=0?-.82:0;
  const start=local(a,arm*.48,1.4+crouch,-.12);
  let theta=a.yaw+(atk?(-1.45+clamp(p,0,1)*2.9)*reverse:.48);
  const len=(a.type==='hammer'?2.15:a.type==='giant'?2.1:1.95)*a.scale;
  const height=atk?(mode===2?Math.cos(p*Math.PI)*1.25:mode===1?(.45-p*.9):0):.55;
  const hand={x:start.x+Math.sin(theta)*.34*a.scale,y:start.y,z:start.z-Math.cos(theta)*.34*a.scale};
  return {a:hand,b:{x:hand.x+Math.sin(theta)*len,y:hand.y+height*a.scale,z:hand.z-Math.cos(theta)*len}};
 }
 function segmentDistance(p,a,b){const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z;const d=x*x+y*y+z*z;const t=clamp(((p.x-a.x)*x+(p.y-a.y)*y+(p.z-a.z)*z)/(d||1),0,1);return Math.hypot(p.x-a.x-x*t,p.y-a.y-y*t,p.z-a.z-z*t);}
 function blocked(x,z,r=.6){return Math.hypot(x,z)>BOUND-r||OBSTACLES.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+r);}
 function move(a,x,z){
  const r=.48*a.scale;
  const wall=Math.hypot(x,z),limit=BOUND-r;a.x=wall>limit?x/wall*limit:x;a.z=wall>limit?z/wall*limit:z;
  for(const o of OBSTACLES){let dx=a.x-o.x,dz=a.z-o.z,d=Math.hypot(dx,dz);if(d<o.r+r){if(d<.001){dx=1;dz=0;d=1;}a.x=o.x+dx/d*(o.r+r);a.z=o.z+dz/d*(o.r+r);}}
 }
 function clearLine(a,b,r=.65){const n=Math.ceil(distance(a,b)/.5);for(let i=1;i<n;i++)if(blocked(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,r))return false;return true;}
 // Small deterministic breadth-first navigation grid, recalculated at most twice per second per robot.
 function pathfind(a,b){
  if(clearLine(a,b,.55*a.scale))return [{x:b.x,z:b.z}];
  const cell=2,N=19,toCell=v=>clamp(Math.round((v+18)/cell),0,N-1),key=(x,z)=>z*N+x;
  const sx=toCell(a.x),sz=toCell(a.z),gx=toCell(b.x),gz=toCell(b.z),start=key(sx,sz),goal=key(gx,gz);
  const queue=[start],parents=new Int16Array(N*N).fill(-1);parents[start]=start;let found=-1;
  for(let i=0;i<queue.length;i++){const cur=queue[i];if(cur===goal){found=cur;break;}const x=cur%N,z=Math.floor(cur/N);for(const [dx,dz]of [[0,-1],[1,0],[0,1],[-1,0]]){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=N||nz>=N)continue;const k=key(nx,nz);if(parents[k]>=0||blocked(nx*cell-18,nz*cell-18,.58*a.scale))continue;parents[k]=cur;queue.push(k);}}
  if(found<0)return [];
  const out=[];for(let cur=found;cur!==start;cur=parents[cur])out.push({x:(cur%N)*cell-18,z:Math.floor(cur/N)*cell-18});return out.reverse();
 }
 function waveTypes(w){
  const count=Math.min(18,2+Math.floor(w*1.35)),pool=['blade'];if(w>=2)pool.push('speed');if(w>=3)pool.push('archer');if(w>=4)pool.push('hammer');if(w>=6)pool.push('armored');
  const list=Array.from({length:count},(_,i)=>pool[(i+w)%pool.length]);if(w%5===0)list[0]='giant';return list;
 }
 function startWave(s){
  s.phase='combat';s.wave++;s.waveTime=0;s.queue=waveTypes(s.wave);s.spawnTimer=.4;s.enemies=[];s.projectiles=[];s.choices=[];
  s.events.push({type:'wave',wave:s.wave});
 }
 function create(seed=1){const s={version:VERSION,rng:(seed>>>0)||1,tick:0,time:0,wave:0,waveTime:0,phase:'combat',score:0,kills:0,severed:0,player:actor(0,'player',0,8),enemies:[],queue:[],projectiles:[],events:[],choices:[],upgrades:{},energy:100,nextId:1,spawnTimer:0,attackWas:false,jumpWas:false,dodgeWas:false,reason:''};startWave(s);return s;}
 function emit(s,e){if(s.events.length<100)s.events.push(e);}
 function end(s,reason){s.phase='dead';s.reason=reason;emit(s,{type:'death',id:0,x:s.player.x,z:s.player.z});}
 function destroy(s,a,part,source){
  const pose=segments({...a,hp:{...a.hp,[part]:1}}).find(p=>p.name===part),droppedBlade=blade(a);
  a.hp[part]=0;emit(s,{type:'sever',id:a.id,part,...pose,color:TYPES[a.type]?.color||0x60eaff});
  if(source?.id===0){s.severed++;s.score+=20;}
  if(part==='rightArm')emit(s,{type:'weapon',id:a.id,...droppedBlade.b,color:TYPES[a.type]?.color||0x60eaff});
  if(part==='core'||part==='head'){
   a.alive=false;a.attack=null;
   for(const p of segments(a))emit(s,{type:'sever',id:a.id,part:p.name,...p,color:TYPES[a.type]?.color||0x60eaff});
   emit(s,{type:'destroy',id:a.id,x:a.x,y:1,z:a.z,boss:a.type==='giant'});
   if(a.id===0)end(s,part==='head'?'Optics destroyed':'Core destroyed');else{s.kills++;s.score+=(TYPES[a.type]?.score||100)+s.wave*10;s.energy=clamp(s.energy+8,0,100);}
  }else if(a.id===0&&a.hp.leftArm<=0&&a.hp.rightArm<=0){a.alive=false;end(s,'Both weapon arms destroyed');}
 }
 function damage(s,target,part,amount,source,point){
  point={x:point.x,y:point.y??1,z:point.z};
  if(!target.alive||target.invulnerable>0||target.spawn>0||target.hp[part]<=0)return false;
  const frontal=Math.abs(angle(bearing(target,source)-target.yaw))<1.25;
  if(target.block&&frontal&&(target.hp.leftArm>0||target.hp.rightArm>0)){
   if(target.id!==0||s.energy>=8){if(target.id===0)s.energy-=8;source.stagger=target.parry>0?.95:.23;source.attack=null;emit(s,{type:target.parry>0?'parry':'block',...point,id:target.id});return false;}
  }
  if(target.armor[part]>0){target.armor[part]-=amount;emit(s,{type:'armor',...point,id:target.id,broken:target.armor[part]<=0});amount*=.35;}
  if(target.id===0)amount/=1+Math.min(6,s.upgrades.armor||0)*.055;
  target.hp[part]-=amount;target.hitFlash=.16;target.stagger=.18+(source.id===0?(s.upgrades.force||0)*.06:0);
  const theta=bearing(source,target),force=(source.id===0?3.5*(1+(s.upgrades.force||0)*.35):2)/target.scale;
  target.vx+=Math.sin(theta)*force;target.vz-=Math.cos(theta)*force;
  emit(s,{type:'hit',id:target.id,part,...point,amount});
  if(target.hp[part]<=0)destroy(s,target,part,source);
  return true;
 }
 function beginAttack(a){if(a.cooldown>0||a.attack||a.stagger>0||a.dodge>0||(a.id!==0&&a.hp.rightArm<=0)||a.hp.leftArm<=0&&a.hp.rightArm<=0)return false;const fast=a.type==='player'?a.tempo||1:a.type==='speed'?.8:1;a.combo++;a.attack={elapsed:0,duration:(a.type==='hammer'||a.type==='giant'?.55:.34)*fast,mode:(a.combo-1)%3,hit:[]};a.block=false;return true;}
 function resolveAttack(s,a,dt){
  const atk=a.attack;if(!atk)return;
  const old=atk.elapsed/atk.duration;atk.elapsed+=dt;const now=clamp(atk.elapsed/atk.duration,0,1);
  const targets=a.id===0?s.enemies:[s.player];
  for(const target of targets){if(!target.alive||atk.hit.includes(target.id)||distance(a,target)>4.5*a.scale)continue;
   let best=null;
   // Swept blade volumes, including the space traversed between rendered frames.
   const samples=Math.max(2,Math.ceil((now-old)*16));
   for(let i=0;i<=samples&&!best;i++){const progress=old+(now-old)*i/samples;if(progress<.08||progress>.96)continue;const sword=blade(a,progress);for(const p of segments(target)){if(segmentDistance(p,sword.a,sword.b)<p.r+.11*a.scale){best=p;break;}}}
   if(best){atk.hit.push(target.id);const amount=a.id===0?30*(1+(s.upgrades.edge||0)*.22):(TYPES[a.type]?.damage||18)*(1+Math.max(0,s.wave-1)*.035);damage(s,target,best.name,amount,a,best);if(a.attack!==atk)break;}
  }
  if(atk.elapsed>=atk.duration&&a.attack===atk){a.attack=null;a.cooldown=a.id===0?.22*(a.tempo||1):.7;}
 }
 function physics(s,a,dt){
  for(const k of ['cooldown','stagger','dodge','invulnerable','parry','hitFlash','spawn'])a[k]=Math.max(0,a[k]-dt);
  move(a,a.x+a.vx*dt,a.z+a.vz*dt);a.vx*=Math.exp(-9*dt);a.vz*=Math.exp(-9*dt);
  if(a.y>0||a.vy>0){a.vy-=19*dt;a.y+=a.vy*dt;if(a.y<=0){a.y=0;a.vy=0;if(a.id===0&&s.upgrades.pulse&&a.attack){emit(s,{type:'pulse',x:a.x,y:.1,z:a.z});for(const e of s.enemies)if(e.alive&&distance(a,e)<3.7){damage(s,e,'core',12*s.upgrades.pulse,a,{x:e.x,y:1,z:e.z});e.stagger=.8;}}}}
 }
 function mobility(a){const legs=Number(a.hp.leftLeg>0)+Number(a.hp.rightLeg>0);return legs===2?1:legs===1?.55:.22;}
 function updatePlayer(s,input){
  const p=s.player;p.yaw=angle(Number(input.yaw)||0);p.tempo=Math.pow(.88,s.upgrades.tempo||0);
  let mx=clamp(Number(input.x)||0,-1,1),mz=clamp(Number(input.z)||0,-1,1),len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len;len=1;}
  const speed=5.6*(1+(s.upgrades.speed||0)*.1)*mobility(p)*(input.block?.5:1)*(p.attack?.7:1);
  p.block=!!input.block&&!p.attack&&!p.dodge&&s.energy>0;if(p.block&&!p.blockWas)p.parry=.19;p.blockWas=!!input.block;
  s.energy=clamp(s.energy+DT*(p.block?3:20)*(1+(s.upgrades.regen||0)*.25),0,100);
  if(input.dodge&&!s.dodgeWas&&p.dodge===0&&p.stagger===0&&s.energy>=28-(s.upgrades.dodge||0)*3){s.energy-=28-(s.upgrades.dodge||0)*3;p.dodge=.36;p.invulnerable=.3;p.attack=null;const dx=len>.1?mx:Math.sin(p.yaw),dz=len>.1?mz:-Math.cos(p.yaw);p.vx=dx*27*(1+(s.upgrades.dodge||0)*.15);p.vz=dz*27*(1+(s.upgrades.dodge||0)*.15);emit(s,{type:'dodge',x:p.x,y:.2,z:p.z});}
  if(input.jump&&!s.jumpWas&&p.y===0&&p.stagger===0){p.vy=7.3;emit(s,{type:'jump',id:0});}
  if(input.attack&&!s.attackWas&&beginAttack(p))emit(s,{type:'swing',id:0});
  // Holding attack continues intentional swings; releasing remains immediately responsive.
  if(input.attack&&!p.attack&&p.cooldown===0&&beginAttack(p))emit(s,{type:'swing',id:0});
  if(p.stagger===0&&p.dodge===0){move(p,p.x+mx*speed*DT,p.z+mz*speed*DT);p.walk+=len*speed*DT*3.7;}
  s.attackWas=!!input.attack;s.jumpWas=!!input.jump;s.dodgeWas=!!input.dodge;
 }
 function updateEnemy(s,e){
  if(!e.alive)return;physics(s,e,DT);if(e.spawn>0||e.stagger>0)return;
  const p=s.player,t=TYPES[e.type],dist=distance(e,p),theta=bearing(e,p);
  if(e.attack){resolveAttack(s,e,DT);return;}
  if(e.telegraph>0){e.telegraph-=DT;e.yaw+=angle(theta-e.yaw)*.09;if(e.telegraph<=0){
   if(e.type==='archer'&&e.hp.rightArm>0){const y=e.y+1.5*e.scale,spread=bearing(e,p);s.projectiles.push({id:s.nextId++,x:e.x,y,z:e.z,vx:Math.sin(spread)*13,vz:-Math.cos(spread)*13,life:3,damage:t.damage});e.cooldown=1.5;emit(s,{type:'shoot',x:e.x,y,z:e.z});}
   else{beginAttack(e);emit(s,{type:'swing',id:e.id});}
  }return;}
  e.yaw+=angle(theta-e.yaw)*Math.min(1,DT*8);e.block=false;
  const armed=e.hp.rightArm>0;
  if(!armed){if(dist<1.3&&e.cooldown<=0){damage(s,p,'core',8,e,{x:p.x,y:1,z:p.z});e.cooldown=1.6;} }
  else if(e.cooldown<=0&&dist<(e.type==='archer'&&e.hp.rightArm<=0?2.3:t.reach)&&clearLine(e,p,.1)){e.telegraph=t.windup/Math.min(1.45,1+s.wave*.012);return;}
  if((e.type==='armored'||e.type==='speed')&&p.attack&&dist<3.8&&e.cooldown>.1){
   if(e.type==='armored'&&e.hp.leftArm>0){e.block=true;return;}
   if(e.type==='speed'&&e.dodge===0&&e.phase<=0){e.dodge=.25;e.invulnerable=.2;e.vx=Math.cos(theta)*12;e.vz=Math.sin(theta)*12;e.phase=2.7;}
  }
  e.phase=Math.max(0,e.phase-DT);if(e.dodge>0)return;
  e.repath-=DT;if(e.repath<=0){e.path=pathfind(e,p);e.repath=.55+(e.id%4)*.1;}
  let target=e.path[0]||p;if(distance(e,target)<1&&e.path.length>1){e.path.shift();target=e.path[0];}
  let dir=bearing(e,target),speed=t.speed*mobility(e)*Math.min(1.35,1+s.wave*.008);
  if(e.type==='archer'&&dist<7&&clearLine(e,p,.6))dir=theta+Math.PI;
  else if(e.type==='speed'&&dist>2.4&&dist<7&&clearLine(e,p,.6))dir+=(e.id%2?1:-1)*.48;
  else if(dist<1.35)speed=0;
  move(e,e.x+Math.sin(dir)*speed*DT,e.z-Math.cos(dir)*speed*DT);e.walk+=speed*DT*3.7;
 }
 function spawn(s){const type=s.queue.shift();if(!type)return;const side=s.nextId%4,positions=s.wave===1?[{x:0,z:-2},{x:5,z:1},{x:-5,z:0},{x:0,z:-6}]:[{x:-14,z:-12},{x:14,z:-12},{x:14,z:12},{x:-14,z:12}];let pos=positions[side];if(distance(pos,s.player)<6)pos=positions[(side+2)%4];const e=actor(s.nextId++,type,pos.x+(random(s)-.5)*2,pos.z+(random(s)-.5)*2,s.wave);e.spawn=.75;e.yaw=bearing(e,s.player);s.enemies.push(e);emit(s,{type:'spawn',x:e.x,y:0,z:e.z,id:e.id});}
 function choose(s,id){if(s.phase!=='upgrade'||!s.choices.includes(id))return false;const u=UPGRADES.find(u=>u.id===id);if(!u)return false;s.upgrades[id]=(s.upgrades[id]||0)+1;const p=s.player;
  if(id==='armor')p.max.core+=25;
  for(const k of Object.keys(p.hp)){const heal=id==='repair'||id==='armor'?p.max[k]:Math.ceil(p.max[k]*.2);p.hp[k]=Math.min(p.max[k],Math.max(1,p.hp[k])+heal);}
  p.attack=null;p.stagger=0;p.telegraph=0;p.block=false;p.vx=p.vz=0;s.energy=id==='repair'?100:Math.min(100,s.energy+40);p.x=0;p.z=8;p.y=0;p.vy=0;startWave(s);return true;
 }
 function step(s,input={}){
  s.events=[];
  if(s.phase==='upgrade'){if(input.upgrade)choose(s,input.upgrade);return s;}
  if(s.phase!=='combat')return s;
  s.tick++;s.time+=DT;s.waveTime+=DT;physics(s,s.player,DT);updatePlayer(s,input);resolveAttack(s,s.player,DT);
  for(const e of s.enemies){if(s.phase!=='combat')break;updateEnemy(s,e);}
  // Resolve crowd overlap without pushing anyone through pylons.
  const alive=s.enemies.filter(e=>e.alive);for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){const a=alive[i],b=alive[j],d=distance(a,b),min=.65*(a.scale+b.scale);if(d<min&&d>.001){const k=(min-d)*.22/d;move(a,a.x+(a.x-b.x)*k,a.z+(a.z-b.z)*k);move(b,b.x+(b.x-a.x)*k,b.z+(b.z-a.z)*k);}}
  for(const bolt of s.projectiles){const before={x:bolt.x,y:bolt.y,z:bolt.z};bolt.x+=bolt.vx*DT;bolt.z+=bolt.vz*DT;bolt.life-=DT;if(blocked(bolt.x,bolt.z,.1)){bolt.life=0;emit(s,{type:'spark',x:bolt.x,y:bolt.y,z:bolt.z});continue;}if(s.player.alive){for(const p of segments(s.player))if(segmentDistance(p,before,bolt)<p.r+.12){damage(s,s.player,p.name,bolt.damage,{id:-1,x:before.x,z:before.z,stagger:0},p);bolt.life=0;break;}}}
  s.projectiles=s.projectiles.filter(p=>p.life>0).slice(-36);
  s.spawnTimer-=DT;if(s.queue.length&&s.spawnTimer<=0&&alive.length<12){spawn(s);s.spawnTimer=s.wave===1?1.2:.65;}
  if(s.phase==='combat'&&!s.queue.length&&!s.enemies.some(e=>e.alive)){s.phase='upgrade';s.score+=s.wave*75;const pool=UPGRADES.filter(u=>(s.upgrades[u.id]||0)<u.max).map(u=>u.id);s.choices=[];while(s.choices.length<3&&pool.length)s.choices.push(pool.splice(Math.floor(random(s)*pool.length),1)[0]);emit(s,{type:'clear',wave:s.wave});}
  return s;
 }
 function snapshot(s){return JSON.parse(JSON.stringify({...s,events:[]}));}
 function restore(saved){if(!saved||saved.version!==VERSION)throw Error('ENGINE_VERSION');return snapshot(saved);}
 return {VERSION,DT,BOUND,OBSTACLES,TYPES,UPGRADES,create,step,choose,snapshot,restore,segments,blade,segmentDistance,blocked,clearLine,pathfind,waveTypes,actor,damage,beginAttack,distance,bearing,angle};
});
