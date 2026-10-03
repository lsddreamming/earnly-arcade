/* Neon Breach: renderer-independent simulation, shared by browser and tests. */
(function(root){
'use strict';
const MAP=['111111111111111111','100000000000000001','100000000000000001','100110011001110001','100000000000000001','100000000000000001','100000000000000001','100110011000011001','100000000000000001','100000000000000001','100000000000000001','100011000110000001','100000000000000001','100000000000000001','100110001100110001','100000000000000001','100000000000000001','111111111111111111'];
const TAU=Math.PI*2;
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
function wall(x,y){return MAP[Math.floor(y)]?.[Math.floor(x)]!=='0'}
function clear(x,y,r=.22){return ![[-r,-r],[r,-r],[-r,r],[r,r]].some(([dx,dy])=>wall(x+dx,y+dy))}
function ray(x,y,a,max=32){const dx=Math.cos(a)*.035,dy=Math.sin(a)*.035;let d=0;while(d<max&&!wall(x,y)){x+=dx;y+=dy;d+=.035}return d}
function move(entity,dx,dy,r=.22){if(clear(entity.x+dx,entity.y,r))entity.x+=dx;if(clear(entity.x,entity.y+dy,r))entity.y+=dy}
function create(random=Math.random){return {random,player:{x:6.5,y:15.5,a:-Math.PI/2,hp:100},enemies:[],shots:[],pickups:[],wave:0,kills:0,score:0,time:0,cooldown:0,flash:0,hurt:0,shield:0,overdrive:0,ended:false,nextWave:1.2,events:[],fired:0,hits:0,nav:null,navTimer:0}}
function emit(s,event){s.events.push(event);if(s.events.length>48)s.events.shift()}
function difficulty(wave){
 const late=Math.max(0,wave-3),pressure=Math.min(1.1,wave*.04+late*.09+late*late*.009);
 return {count:Math.min(16,2+wave+Math.floor(Math.max(0,wave-4)/2)),rusher:1.05+pressure,sentry:.6+pressure,tank:.55+pressure*.8,bolt:Math.min(5.2,2.8+late*.23),shotDelay:Math.max(.7,2.3-wave*.1-late*.055),meleeDelay:Math.max(.52,.85-late*.035),rest:Math.max(.55,2-late*.18)};
}
function spawn(s){
 s.wave++;const rules=difficulty(s.wave),cells=[];
 for(let y=1;y<MAP.length-1;y++)for(let x=1;x<MAP[0].length-1;x++){
  const d=Math.hypot(x+.5-s.player.x,y+.5-s.player.y);
  if(clear(x+.5,y+.5)&&d>3&&d<8.5&&!s.enemies.some(e=>Math.hypot(e.x-x-.5,e.y-y-.5)<.6))cells.push({x:x+.5,y:y+.5});
 }
 for(let i=0;i<rules.count&&cells.length;i++){
  const pos=cells.splice(Math.min(cells.length-1,Math.floor(s.random()*cells.length)),1)[0];
  const type=s.wave>=3&&i%3===0?'tank':s.wave>=2&&i%2===0?'sentry':'rusher',elite=s.wave>=6&&i%5===0,maxHp=(type==='tank'?4:type==='sentry'?2:1)+(elite?1:0);
  s.enemies.push({...pos,type,elite,hp:maxHp,maxHp,attack:.8+s.random()*.8,phase:s.random()*TAU,stride:0,motion:0,spawn:.55,firing:0,charge:0,heading:0});
 }
 s.nextWave=rules.rest;s.navTimer=0;s.score+=s.wave>1?50:0;emit(s,{type:'wave',wave:s.wave});
}
// One shared flood-fill guides all robots around the expanded arena's cover.
function navigation(s){
 const width=MAP[0].length,height=MAP.length,dist=new Int16Array(width*height).fill(-1),queue=[];
 const start=Math.floor(s.player.y)*width+Math.floor(s.player.x);dist[start]=0;queue.push(start);
 for(let i=0;i<queue.length;i++){const id=queue[i],x=id%width,y=Math.floor(id/width);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,next=ny*width+nx;if(nx<0||ny<0||nx>=width||ny>=height||wall(nx+.5,ny+.5)||dist[next]>=0)continue;dist[next]=dist[id]+1;queue.push(next)}}
 s.nav=dist;s.navTimer=.35;
}
function steer(s,e,visible){
 if(visible)return Math.atan2(s.player.y-e.y,s.player.x-e.x);
 const width=MAP[0].length,x=Math.floor(e.x),y=Math.floor(e.y);let best=s.nav[y*width+x],tx=x+.5,ty=y+.5;
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,d=s.nav[ny*width+nx];if(d>=0&&(best<0||d<best)){best=d;tx=nx+.5;ty=ny+.5}}
 let a=Math.atan2(ty-e.y,tx-e.x),d=Math.hypot(tx-e.x,ty-e.y);
 if(ray(e.x,e.y,a,d)<d-.07){tx=x+.5;ty=y+.5;a=Math.atan2(ty-e.y,tx-e.x)}return a;
}

// The sight and the weapon use the same cover and aim checks.
function aim(s){
 const p=s.player;let target=null,dist=Infinity;
 for(const e of s.enemies){
  const d=Math.hypot(e.x-p.x,e.y-p.y),diff=angle(Math.atan2(e.y-p.y,e.x-p.x)-p.a);
  if(Math.abs(diff)<Math.atan2(.32,d)+.025&&d<dist&&ray(p.x,p.y,Math.atan2(e.y-p.y,e.x-p.x),d)>=d-.07){target=e;dist=d}
 }
 return target;
}
function fire(s){
 if(s.ended||s.cooldown>0)return false;
 s.cooldown=s.overdrive>0?.12:.24;s.flash=.1;s.fired++;
 const p=s.player,target=aim(s);
 // Visual endpoints follow the accepted hit, or stop just in front of solid cover.
 const wallDistance=Math.max(0,ray(p.x,p.y,p.a)-.06);
 const endpoint=target?{x:target.x,y:target.y}:{x:p.x+Math.cos(p.a)*wallDistance,y:p.y+Math.sin(p.a)*wallDistance};
 emit(s,{type:'fire',hit:!!target,...endpoint});
 if(!target)emit(s,{type:'wall-impact',...endpoint});
 if(target){
  s.hits++;target.hp--;target.hit=.12;
  emit(s,{type:'impact',x:target.x,y:target.y,killed:target.hp<=0,robot:target.type,elite:!!target.elite,phase:target.phase||0,points:target.type==='tank'?150:target.type==='sentry'?100:75});
  if(target.hp<=0){
   s.enemies.splice(s.enemies.indexOf(target),1);s.kills++;s.score+=target.type==='tank'?150:target.type==='sentry'?100:75;
   if(s.kills%4===0)s.pickups.push({x:target.x,y:target.y,type:['health','shield','overdrive'][Math.floor(s.kills/4-1)%3],life:18});
  }
 }
 return !!target;
}
function damage(s,n,source){
 if(s.hurt>0||s.ended)return;
 if(s.shield>0)n=Math.ceil(n*.35);
 s.player.hp=Math.max(0,s.player.hp-n);s.hurt=.45;
 emit(s,{type:'damage',shield:s.shield>0,x:source?.x??s.player.x,y:source?.y??s.player.y});
 if(!s.player.hp)s.ended=true;
}
function tick(s,dt,input={}){if(s.ended)return;dt=Math.min(.05,Math.max(0,dt));s.time+=dt;for(const k of ['cooldown','flash','hurt','shield','overdrive'])s[k]=Math.max(0,s[k]-dt);const p=s.player;p.a=angle(p.a+(input.turn||0)*dt);let f=input.forward||0,st=input.strafe||0;const norm=Math.max(1,Math.hypot(f,st));f/=norm;st/=norm;move(p,(Math.cos(p.a)*f-Math.sin(p.a)*st)*2.4*dt,(Math.sin(p.a)*f+Math.cos(p.a)*st)*2.4*dt);if(input.fire)fire(s);
s.navTimer-=dt;if(!s.nav||s.navTimer<=0)navigation(s);const rules=difficulty(s.wave);
for(const e of s.enemies){
 e.hit=Math.max(0,(e.hit||0)-dt);e.spawn=Math.max(0,(e.spawn||0)-dt);e.firing=Math.max(0,(e.firing||0)-dt);
 const d=Math.hypot(p.x-e.x,p.y-e.y),a=Math.atan2(p.y-e.y,p.x-e.x),oldX=e.x,oldY=e.y;
 e.attack-=dt;const visible=ray(e.x,e.y,a,d)>=d-.07;
 if(d>(e.type==='sentry'&&visible?3:.55)){
  const speed=rules[e.type]*(e.elite?1.06:1),heading=steer(s,e,visible);
  move(e,Math.cos(heading)*speed*dt,Math.sin(heading)*speed*dt);
 }
 const traveled=Math.hypot(e.x-oldX,e.y-oldY);
 e.motion=dt>0?Math.min(1,traveled/(dt*1.1)):0;e.stride=(e.stride||0)+traveled*9;
 e.heading=traveled>.0001?Math.atan2(e.y-oldY,e.x-oldX):a;
 e.charge=visible&&(e.type==='sentry'||d<1.1)?Math.max(0,Math.min(1,1-e.attack/(e.type==='sentry'?.65:.35))):0;
 if(e.type==='sentry'&&visible&&e.attack<=0){
  s.shots.push({x:e.x,y:e.y,vx:Math.cos(a)*rules.bolt,vy:Math.sin(a)*rules.bolt,life:5});
  e.attack=rules.shotDelay;e.firing=.16;e.charge=0;emit(s,{type:'robot-fire',x:e.x,y:e.y});
 }else if(d<.65&&e.attack<=0){damage(s,e.type==='tank'?25:14,e);e.attack=rules.meleeDelay;e.firing=.18;e.charge=0}
}
for(const b of s.shots){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(wall(b.x,b.y))b.life=0;if(Math.hypot(b.x-p.x,b.y-p.y)<.26){damage(s,18,{x:b.x-b.vx*.2,y:b.y-b.vy*.2});b.life=0}}s.shots=s.shots.filter(b=>b.life>0);
for(const item of s.pickups){item.life-=dt;if(Math.hypot(item.x-p.x,item.y-p.y)<.55){const before=p.hp;if(item.type==='health')p.hp=Math.min(100,p.hp+30);else s[item.type]=8;emit(s,{type:'pickup',kind:item.type,amount:item.type==='health'?p.hp-before:8});item.life=0}}s.pickups=s.pickups.filter(i=>i.life>0);if(!s.enemies.length){s.nextWave-=dt;if(s.nextWave<=0){spawn(s)}}if(s.time>=180)s.ended=true;
}
const api={MAP,difficulty,navigation,angle,wall,clear,ray,move,create,spawn,aim,fire,tick};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NeonBreachEngine=api;
})(typeof window!=='undefined'?window:globalThis);
