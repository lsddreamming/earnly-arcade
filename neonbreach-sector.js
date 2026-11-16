/* Sector Run: an opt-in, finite Neon Breach mission. No network or reward changes. */
(function(root){
'use strict';
const E=root.NeonBreachEngine,baseTick=E.tick;
const MAP=Array.from({length:18},(_,y)=>y===0||y===17?'111111111111111111':'100000001000000001');
MAP[8]='100000001111101111';
MAP[4]='100110001000000001';
MAP[6]='100010001010000001';
MAP[10]='100100001000010001';
MAP[11]='100100001000010001';
MAP[12]='100000001001100001';
// Extend the southern approach with new chambers and cross-corridors.
// The original key/door/exit route remains intact for returning players.
MAP.splice(17,1,
 '100000001000000001',
 '100110001001100001',
 '100000001000000001',
 '100000001010000001',
 '100011001000110001',
 '100000001000000001',
 '100000001000000001',
 '100110001011000001',
 '100000001000000001',
 '111111111111111111');
// Southern entry lanes, all facing north along clear floor toward the key.
const STARTS=[
 {x:1.5,y:25.5},{x:6.5,y:24.5},{x:3.5,y:23.5},{x:7.5,y:22.5}
];
function sectorEnemies(s,random){
 const zones=[[2,6,2],[7,12,3],[13,18,3],[19,25,4]];
 const placed=[];
 for(const [from,to,count] of zones){
  const cells=[];
  for(let y=from;y<=to;y++)for(let x=2;x<16;x++){
   const px=x+.5,py=y+.5;
   if(!E.clear(px,py,.24,s.map)||Math.hypot(px-s.player.x,py-s.player.y)<3.5)continue;
   if(s.supplies.some(item=>Math.hypot(px-item.x,py-item.y)<1.2))continue;
   if(Math.hypot(px-s.exit.x,py-s.exit.y)<2)continue;
   cells.push({x:px,y:py});
  }
  for(let i=0;i<count;i++){
   const eligible=cells.filter(c=>placed.every(e=>Math.hypot(c.x-e.x,c.y-e.y)>2));
   if(!eligible.length)break;
   const chosen=eligible[Math.floor(random()*eligible.length)];
   const type=i===1&&from>6?'tank':i%2===0?'sentry':'rusher';
   const role=type==='sentry'?(random()<.55?'rail':undefined):type==='rusher'&&random()<.65?'plasma':undefined;
   const hp=type==='tank'?6:type==='sentry'?3:2;
   placed.push({x:chosen.x,y:chosen.y,type,role,hp,maxHp:hp,attack:.85+random()*.65,phase:random()*Math.PI*2,stride:0,motion:0,spawn:1.5+random(),firing:0,charge:0,heading:0});
  }
 }
 return placed;
}
function message(s,kind){s.events.push({type:'pickup',kind,amount:0})}
E.createSector=function(random=Math.random,previousStart=-1){
 const s=E.create(random);s.mode='sector';s.map=MAP.slice();s.wave=1;s.nextWave=Infinity;
 const choices=STARTS.map((_,i)=>i).filter(i=>i!==previousStart);
 s.sectorStart=choices[Math.floor(random()*choices.length)];
 Object.assign(s.player,STARTS[s.sectorStart],{a:-Math.PI/2});
 s.key=false;s.doorOpen=false;s.bossSpawned=false;s.bossDefeated=false;s.weapon='carbine';s.hasShotgun=false;s.shells=0;s.completed=false;
 s.exit={x:14.5,y:3.5};s.supplies=[
 {x:3.5,y:2.5,type:'key'},{x:5.5,y:11.5,type:'shotgun'},
 {x:11.5,y:14.5,type:'ammo'},{x:14.5,y:6.5,type:'ammo'}
 ];
 s.pickups=[{x:2.5,y:20.5,type:'health',life:Infinity},{x:2.5,y:7.5,type:'health',life:Infinity},{x:11.5,y:11.5,type:'health',life:Infinity}];
 s.enemies=sectorEnemies(s,random);
 return s;
};
E.sectorObjective=function(s){
 if(s.completed)return 'Exit reached';
 if(!s.key)return 'Find the gold access key';
 if(!s.doorOpen)return 'Open the gold door on your radar';
 if(!s.bossDefeated){const boss=s.enemies.find(e=>e.boss);return boss?'Defeat the Sector Warden · '+Math.max(0,boss.hp)+'/'+boss.maxHp+' hull':'Sector Warden incoming';}
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
  if(item.type==='key'){s.key=true;s.wave=3;}
  if(item.type==='shotgun'){s.hasShotgun=true;s.shells+=8;s.weapon='shotgun'}
  if(item.type==='ammo')s.shells=Math.min(24,s.shells+6);
  message(s,item.type);
 }
 if(!s.doorOpen&&Math.hypot(p.x-8.5,p.y-13.5)<1.8){
  if(s.key){s.doorOpen=true;s.wave=5;s.map[13]=s.map[13].slice(0,8)+'0'+s.map[13].slice(9);s.nav=null;message(s,'door');
   // One scripted boss guards the final exit; never respawn it or farm it for rewards.
   if(!s.bossSpawned){s.bossSpawned=true;s.enemies.push({x:14.5,y:5.5,type:'tank',role:'plasma',elite:true,boss:true,hp:16,maxHp:16,attack:1.6,phase:0,stride:0,motion:0,spawn:2.5,firing:0,charge:0,heading:0});message(s,'boss')}}
  else if(!s.lockNotice||s.time-s.lockNotice>4){s.lockNotice=s.time||.001;message(s,'locked')}
 }
 baseTick(s,dt,input);
 if(s.bossSpawned&&!s.bossDefeated&&!s.enemies.some(e=>e.boss)){s.bossDefeated=true;message(s,'boss-down');}
 if(!s.ended&&s.doorOpen&&s.bossDefeated&&Math.hypot(s.exit.x-p.x,s.exit.y-p.y)<.7){
  s.completed=true;s.ended=true;message(s,'exit');
 }
};
if(typeof module!=='undefined'&&module.exports)module.exports=E;
})(typeof window!=='undefined'?window:globalThis);
