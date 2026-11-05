/* Sector Run: an opt-in, finite Neon Breach mission. No network or reward changes. */
(function(root){
'use strict';
const E=root.NeonBreachEngine,baseTick=E.tick;
const row=(openings=[])=>Array.from({length:18},(_,x)=>openings.includes(x)?'0':'1').join('');
const MAP=Array.from({length:18},(_,y)=>y===0||y===17?'111111111111111111':'100000001000000001');
MAP[8]='100000001111101111';
MAP[4]='100110001000000001';
MAP[12]='100000001001100001';
function message(s,kind){s.events.push({type:'pickup',kind,amount:0})}
E.createSector=function(random=Math.random){
 const s=E.create(random);s.mode='sector';s.map=MAP.slice();s.wave=1;s.nextWave=Infinity;
 Object.assign(s.player,{x:3.5,y:14.5,a:-Math.PI/2});
 s.key=false;s.doorOpen=false;s.weapon='carbine';s.hasShotgun=false;s.shells=0;s.completed=false;
 s.exit={x:14.5,y:3.5};s.supplies=[
 {x:3.5,y:2.5,type:'key'},{x:5.5,y:11.5,type:'shotgun'},
 {x:11.5,y:14.5,type:'ammo'},{x:14.5,y:6.5,type:'ammo'}
 ];
 s.pickups=[{x:2.5,y:7.5,type:'health',life:Infinity},{x:11.5,y:11.5,type:'health',life:Infinity}];
 s.enemies=[[5.5,9.5,'rusher'],[6.5,3.5,'sentry'],[2.5,4.5,'rusher'],[11.5,13.5,'rusher'],[15.5,10.5,'sentry'],[11.5,5.5,'tank'],[15.5,3.5,'sentry']].map(([x,y,type],i)=>({x,y,type,hp:type==='tank'?4:type==='sentry'?2:1,maxHp:type==='tank'?4:type==='sentry'?2:1,attack:1.5,phase:i,stride:0,motion:0,spawn:2.5,firing:0,charge:0,heading:0}));
 return s;
};
E.sectorObjective=function(s){
 if(!s.key)return 'Find the gold access key';
 if(!s.doorOpen)return 'Open the gold door on your radar';
 return 'Reach the green exit beacon';
};
E.switchWeapon=function(s){if(s.mode!=='sector'||!s.hasShotgun||s.ended)return false;s.weapon=s.weapon==='shotgun'?'carbine':s.shells>0?'shotgun':'carbine';return true};
E.tick=function(s,dt,input={}){
 if(s.mode!=='sector')return baseTick(s,dt,input);
 if(s.ended)return;
 const p=s.player;
 for(const item of s.supplies){
  if(item.taken||Math.hypot(item.x-p.x,item.y-p.y)>.6)continue;
  item.taken=true;
  if(item.type==='key')s.key=true;
  if(item.type==='shotgun'){s.hasShotgun=true;s.shells+=8;s.weapon='shotgun'}
  if(item.type==='ammo')s.shells=Math.min(24,s.shells+6);
  message(s,item.type);
 }
 if(!s.doorOpen&&Math.hypot(p.x-8.5,p.y-13.5)<1.8){
  if(s.key){s.doorOpen=true;s.map[13]=s.map[13].slice(0,8)+'0'+s.map[13].slice(9);s.nav=null;message(s,'door')}
  else if(!s.lockNotice||s.time-s.lockNotice>4){s.lockNotice=s.time||.001;message(s,'locked')}
 }
 baseTick(s,dt,input);
 if(!s.ended&&s.doorOpen&&Math.hypot(s.exit.x-p.x,s.exit.y-p.y)<.7){
  s.completed=true;s.ended=true;message(s,'exit');
 }
};
if(typeof module!=='undefined'&&module.exports)module.exports=E;
})(typeof window!=='undefined'?window:globalThis);
