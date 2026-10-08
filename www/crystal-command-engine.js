(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CrystalCommand=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const VERSION=6,SIZE=64,STEP=.05,BATTLE_LIMIT=1200;
const MAPS=Object.freeze({
 frontier:{name:'Crystal Frontier',description:'Wide flanking routes and a dangerous rich center.'},
 crossing:{name:'Shattered Crossing',description:'Three passages divide the battlefield. Watch your flanks.'},
 crescent:{name:'Crescent Basin',description:'Sheltered expansions with long routes around broken ridges.'}
});
const DIFFICULTIES=Object.freeze({easy:{name:'Easy',pace:3.8,workers:8,attackAt:180,force:3,wave:35,armyCap:6,techAt:150},normal:{name:'Normal',pace:2.4,workers:12,attackAt:35,force:5,wave:0,armyCap:80,techAt:70},hard:{name:'Hard',pace:1.6,workers:10,attackAt:25,force:3,wave:0,armyCap:80,techAt:55}});
const TYPES=Object.freeze({
 worker:{name:'Miner',cost:50,hp:45,speed:2.8,range:0,damage:0,time:4,supply:1,vision:5},
 scout:{name:'Scout',cost:75,hp:65,speed:4,range:2.1,damage:8,time:5,supply:1,vision:8,cool:.7},
 laser:{name:'Striker',cost:100,hp:120,speed:2.2,range:4.2,damage:15,time:7,supply:2,vision:6,cool:.9,airDamage:12,role:'Ground + air'},
 siege:{name:'Siege bot',cost:200,hp:250,speed:1.4,range:6,damage:30,time:11,supply:4,vision:7,cool:1.8,requires:['lab'],splash:1.25,role:'Ground artillery'},
 raider:{name:'Raider',cost:90,hp:85,speed:3.8,range:2.6,damage:10,time:6,supply:1,vision:6,cool:.65,role:'Fast ground assault'},
 medic:{name:'Field medic',cost:100,hp:80,speed:2.6,range:3,damage:0,heal:8,time:8,supply:2,vision:6,cool:1,role:'Heals ground troops'},
 guardian:{name:'Skyguard',cost:175,hp:200,speed:1.9,range:5.5,damage:10,airDamage:28,time:10,supply:3,vision:7,cool:1.2,requires:['armory'],role:'Anti-air walker'},
 interceptor:{name:'Interceptor',cost:180,hp:125,speed:4.5,range:4.5,damage:8,airDamage:24,time:10,supply:2,vision:9,cool:.9,flying:true,role:'Air superiority'},
 bomber:{name:'Bomber',cost:240,hp:180,speed:2.8,range:4,damage:28,time:13,supply:3,vision:7,cool:1.6,flying:true,splash:1.1,requires:['armory'],role:'Ground splash attack'},
 cruiser:{name:'Storm cruiser',cost:400,hp:420,speed:1.6,range:5,damage:32,airDamage:32,time:20,supply:6,vision:8,cool:1.3,flying:true,requires:['lab','armory'],role:'Heavy ground + air'},
 base:{name:'Command base',cost:350,hp:1600,time:16,radius:1.5,vision:8},
 factory:{name:'War factory',cost:180,hp:650,time:10,radius:1.1,vision:5},
 turret:{name:'Sentry',cost:130,hp:420,time:9,radius:.8,range:5,damage:18,cool:1,vision:6,airDamage:18,role:'Ground + air defense'},
 relay:{name:'Supply relay',cost:100,hp:300,time:7,radius:.8,vision:5,role:'+12 troop slots'},
 barracks:{name:'Assault bay',cost:150,hp:550,time:9,radius:1,vision:5,role:'Raiders + medics'},
 starport:{name:'Star hangar',cost:260,hp:700,time:14,radius:1.2,vision:6,requires:['factory'],role:'Produces aircraft'},
 armory:{name:'Arsenal',cost:200,hp:550,time:12,radius:1,vision:5,requires:['factory'],role:'Unlocks advanced troops'},
 flak:{name:'Sky shield',cost:150,hp:400,time:9,radius:.8,range:6,damage:0,airDamage:26,cool:1,vision:7,role:'Air-only defense'},
 lab:{name:'Tech core',cost:220,hp:500,time:12,radius:1,vision:5}
});
const PRODUCERS=Object.freeze({base:['worker','scout'],barracks:['raider','medic'],factory:['laser','siege','guardian'],starport:['interceptor','bomber','cruiser']});
const unit=k=>!!TYPES[k]?.supply;
function unlockMessage(entities,side,kind){const missing=TYPES[kind]?.requires?.find(type=>!entities.some(e=>e.side===side&&e.hp>0&&e.type===type&&!e.build));return missing?'Complete a '+TYPES[missing].name+' first':''}
function canTarget(a,b){const d=TYPES[a.type],t=TYPES[b.type];return !!(d&&t&&(t.flying?d.airDamage:d.damage))}
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const key=(x,y)=>y*SIZE+x;
function makeEntity(s,type,side,x,y,built=true){const d=TYPES[type];const e={id:s.next++,type,side,x,y,hp:d.hp,maxHp:d.hp,build:built?0:d.time,queue:[],cool:0,path:[],order:null,carry:0,mine:0,progress:0,patch:null,home:null,rally:null,research:null};s.entities.push(e);return e}
function create({practice=false,difficulty='normal',learning=false,map='frontier'}={}){
 map=!learning&&Object.hasOwn(MAPS,map)?map:'frontier';
 difficulty=Object.hasOwn(DIFFICULTIES,difficulty)?difficulty:'normal';
 const s={version:VERSION,map,botMemory:{structures:{},scoutIndex:0,retreatUntil:0,tacticsAt:0,expansion:null},tick:0,time:0,next:1,ended:false,winner:null,reason:'',practice,learning:practice&&learning===true,difficulty,botAttackAt:0,entities:[],crystals:[],rocks:[],events:[],visualEvents:[],fxNext:1,players:[0,1].map(()=>({crystals:250,upgrade:0,armor:0,alerts:{},kills:0,mined:0,knownCrystals:{},seen:Array(SIZE*SIZE).fill(0)})),botAt:3};
 const fields=[{name:'Home field',points:[[3,6],[5,3],[3,3],[2,5],[2,7],[4,2]],left:2400},
  {name:'Near expansion',points:[[16,7],[16,9],[15,5],[17,6],[17,8],[17,10]],left:2400},
  {name:'Outer expansion',points:[[12,26],[12,28],[11,24],[13,25],[13,27],[13,29]],left:2400},
  {name:'Ridge expansion',points:[[27,12],[29,12],[25,11],[26,13],[28,13],[30,13]],left:2800},
  {name:'Frontier field',points:[[9,43],[10,45],[8,45],[9,47],[11,44],[11,46]],left:2800}];
 if(map==='crossing'){for(const f of fields)if(f.name==='Near expansion')f.points=f.points.map(([x,y])=>[x+3,y+2]);}
 if(map==='crescent'){for(const f of fields)if(f.name==='Outer expansion')f.points=f.points.map(([x,y])=>[x-4,y+3]);}
 for(const f of fields)for(const side of [0,1])for(const [x,y]of f.points){s.crystals.push({id:s.next++,x:side?SIZE-1-x:x,y:side?SIZE-1-y:y,left:f.left,initial:f.left,rich:false,field:f.name+' '+side})}
 for(const [x,y]of [[31,32],[32,31],[30,31],[33,32]])s.crystals.push({id:s.next++,x,y,left:3600,initial:3600,rich:true,field:'Central rich field'});
 for(const [x,y]of [[12,12],[13,12],[12,13],[15,18],[15,19],[18,14],[19,14],[9,23],[10,23]]){s.rocks.push({x,y});s.rocks.push({x:SIZE-1-x,y:SIZE-1-y})}
 // Mirrored broken ridges leave multiple wide routes between the bases.
 for(const [cx,cy]of [[23,21],[24,35],[19,43],[37,12]])for(const [dx,dy]of [[0,0],[1,0],[2,0],[2,1],[3,1]]){const x=cx+dx,y=cy+dy;s.rocks.push({x,y},{x:SIZE-1-x,y:SIZE-1-y})}
 if(map!=='frontier'){
  const rocks=[];const add=(x,y)=>{for(const [a,b]of [[x,y],[SIZE-1-x,SIZE-1-y]])if(!s.crystals.some(n=>Math.hypot(n.x-a,n.y-b)<3))rocks.push({x:a,y:b})};
  if(map==='crossing')for(let y=0;y<32;y++)if(!(y>=14&&y<=20)&&y<29){add(31,y);add(32,y);}
  if(map==='crescent')for(let x=5;x<=28;x++)if(x<16||x>22){add(x,20);add(x,21);}
  s.rocks=[...new Map(rocks.map(r=>[key(r.x,r.y),r])).values()];
 }
 for(const side of[0,1]){const p=side?SIZE-7:6;makeEntity(s,'base',side,p,p);for(let j=0;j<4;j++)makeEntity(s,'worker',side,p+(j%2)*.7-1,p+Math.floor(j/2)*.7+2)}
 if(s.learning){s.entities=s.entities.filter(e=>e.side===0||e.type==='base');const target=s.entities.find(e=>e.side===1);target.x=20;target.y=6;target.hp=target.maxHp=350;}
 vision(s);return s;
}
function blocked(s,x,y){return x<0||y<0||x>=SIZE||y>=SIZE||s.rocks.some(r=>r.x===x&&r.y===y)}
function path(s,a,b){
 const sx=clamp(Math.floor(a.x),0,SIZE-1),sy=clamp(Math.floor(a.y),0,SIZE-1),tx=clamp(Math.floor(b.x),0,SIZE-1),ty=clamp(Math.floor(b.y),0,SIZE-1);
 if(blocked(s,tx,ty))return [];
 const start=key(sx,sy),end=key(tx,ty),prev=new Map(),g=new Map([[start,0]]),closed=new Set(),open=[];
 const rocks=new Set(s.rocks.map(r=>key(r.x,r.y)));let serial=0;
 const less=(a,b)=>a.f<b.f||a.f===b.f&&(a.h<b.h||a.h===b.h&&a.serial<b.serial);
 const push=(n,cost,h)=>{const item={n,cost,h,f:cost+h,serial:serial++};let i=open.length;open.push(item);while(i){const p=(i-1)>>1;if(!less(item,open[p]))break;open[i]=open[p];i=p}open[i]=item};
 const pop=()=>{const result=open[0],last=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let j=i*2+1;if(j+1<open.length&&less(open[j+1],open[j]))j++;if(!less(open[j],last))break;open[i]=open[j];i=j}open[i]=last}return result};
 push(start,0,Math.abs(tx-sx)+Math.abs(ty-sy));
 while(open.length){const item=pop(),n=item.n;if(closed.has(n)||item.cost!==g.get(n))continue;
  if(n===end){const out=[{x:b.x,y:b.y}];let at=n;while(at!==start){out.unshift({x:at%SIZE+.5,y:Math.floor(at/SIZE)+.5});at=prev.get(at)}return out}
  closed.add(n);const x=n%SIZE,y=Math.floor(n/SIZE);
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(nx<0||ny<0||nx>=SIZE||ny>=SIZE||rocks.has(k)||closed.has(k))continue;const score=item.cost+1;if(score<(g.get(k)??Infinity)){prev.set(k,n);g.set(k,score);push(k,score,Math.abs(nx-tx)+Math.abs(ny-ty))}}
 }
 return [];
}
function move(s,e,target,dt){if(TYPES[e.type].flying){e.path=[];const d=dist(e,target),budget=TYPES[e.type].speed*dt;if(d<=budget){e.x=target.x;e.y=target.y;return true}e.x+=(target.x-e.x)/d*budget;e.y+=(target.y-e.y)/d*budget;return false}if(!e.path.length||dist(e.path[e.path.length-1],target)>.7)e.path=path(s,e,target);if(!e.path.length)return false;let budget=TYPES[e.type].speed*dt;while(e.path.length&&budget>0){const p=e.path[0],d=dist(e,p);if(d<=budget){e.x=p.x;e.y=p.y;budget-=d;e.path.shift()}else{e.x+=(p.x-e.x)/d*budget;e.y+=(p.y-e.y)/d*budget;budget=0}}return dist(e,target)<.65}
function supply(s,side){const list=s.entities.filter(e=>e.side===side&&e.hp>0);return{used:list.reduce((n,e)=>n+(TYPES[e.type].supply||0)+e.queue.reduce((q,k)=>q+(TYPES[k].supply||0),0),0),cap:list.filter(e=>!e.build).reduce((n,e)=>n+(e.type==='base'?16:e.type==='relay'?12:0),0)}}
function vision(s){s.visible=[new Uint8Array(SIZE*SIZE),new Uint8Array(SIZE*SIZE)];for(const e of s.entities){if(e.hp<=0)continue;const r=TYPES[e.type].vision||5;for(let y=Math.max(0,Math.floor(e.y-r));y<Math.min(SIZE,e.y+r+1);y++)for(let x=Math.max(0,Math.floor(e.x-r));x<Math.min(SIZE,e.x+r+1);x++)if(Math.hypot(x+.5-e.x,y+.5-e.y)<=r){s.visible[e.side][key(x,y)]=1;s.players[e.side].seen[key(x,y)]=1}}for(const side of [0,1])for(const n of s.crystals)if(canSee(s,side,n))s.players[side].knownCrystals[n.id]={...n}}
function canSee(s,side,e){return!!s.visible[side]?.[key(clamp(Math.floor(e.x),0,SIZE-1),clamp(Math.floor(e.y),0,SIZE-1))]}
// The client preview uses its fog-filtered view; the host checks full state again.
function placement(s,side,kind,rawX,rawY){
 const d=Object.hasOwn(TYPES,kind)?TYPES[kind]:null;
 if(!d||unit(kind)||!Number.isFinite(rawX)||!Number.isFinite(rawY))return{ok:false,message:'Invalid building'};
 const x=clamp(rawX,1.5,SIZE-2.5),y=clamp(rawY,1.5,SIZE-2.5),at={x,y},fail=message=>({ok:false,message,x,y});
 const own=s.entities.filter(e=>e.side===side&&e.hp>0),visible=s.player?s.visible:s.visible[side],player=s.player||s.players[side];
 const locked=unlockMessage(s.entities,side,kind);if(locked)return fail(locked);
 if(!visible[key(Math.floor(x),Math.floor(y))])return fail('Scout this location first');
 if(!own.some(e=>e.type==='worker'&&dist(e,at)<8))return fail('Move a Miner nearby to build');
 if(blocked(s,Math.floor(x),Math.floor(y))||s.entities.some(e=>!unit(e.type)&&dist(e,at)<(TYPES[e.type].radius||1)+d.radius+.35)||s.crystals.some(n=>dist(n,at)<d.radius+.8)||s.rocks.some(n=>dist(n,at)<d.radius+.7))return fail('Choose clear ground');
 if(own.filter(e=>!unit(e.type)).length>=24)return fail('Building limit reached');
 if(player.crystals<d.cost)return fail('More crystals needed');
 return{ok:true,x,y,message:'Release to build'};
}
function command(s,side,c){
 if(s.ended||!(side===0||side===1)||!c||typeof c!=='object')return{ok:false,message:'Battle unavailable'};
 const p=s.players[side],own=s.entities.filter(e=>e.side===side&&e.hp>0);
 if(['train','build'].includes(c.type)&&!Object.hasOwn(TYPES,c.kind))return{ok:false,message:'Unknown unit or building'};
 if(c.type==='surrender'){s.ended=true;s.winner=1-side;s.reason='Commander surrendered';return{ok:true}}
 if(c.type==='train'){
  const d=TYPES[c.kind],producer=own.find(e=>e.id===c.id);if(!d||!unit(c.kind)||!producer||producer.build)return{ok:false,message:'Select a completed production building'};
  if(!PRODUCERS[producer.type]?.includes(c.kind))return{ok:false,message:'That unit needs a different building'};
  const locked=unlockMessage(own,side,c.kind);if(locked)return{ok:false,message:locked};
  if(producer.queue.length>=5)return{ok:false,message:'Queue full'};const pop=supply(s,side);if(pop.used+d.supply>pop.cap)return{ok:false,message:'Not enough troop space. Build a Supply relay for +12 slots.'};
  if(own.filter(e=>unit(e.type)).length+own.reduce((n,e)=>n+e.queue.length,0)>=80)return{ok:false,message:'Robot limit reached'};
  if(p.crystals<d.cost)return{ok:false,message:'More crystals needed'};p.crystals-=d.cost;producer.queue.push(c.kind);return{ok:true};
 }
 if(c.type==='build'){
  const site=placement(s,side,c.kind,c.x,c.y);if(!site.ok)return site;p.crystals-=TYPES[c.kind].cost;makeEntity(s,c.kind,side,site.x,site.y,false);return{ok:true};
 }
 if(c.type==='rally'){
  const producer=own.find(e=>e.id===c.id&&!e.build&&Object.hasOwn(PRODUCERS,e.type));if(!producer)return{ok:false,message:'Select a completed production building'};
  if(!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<0||c.x>=SIZE||c.y<0||c.y>=SIZE||(producer.type!=='starport'&&blocked(s,Math.floor(c.x),Math.floor(c.y))))return{ok:false,message:'Choose clear ground for the rally point'};
  const n=s.crystals.find(n=>n.id===c.target&&n.left>0&&canSee(s,side,n));producer.rally={x:c.x,y:c.y,target:producer.type==='base'?n?.id:undefined};return{ok:true};
 }
 if(c.type==='upgrade'){
  const kind=c.kind||'weapons';if(!['weapons','armor'].includes(kind))return{ok:false,message:'Unknown research'};
  const labs=own.filter(e=>e.type==='lab'&&!e.build),lab=c.id?labs.find(e=>e.id===c.id):labs.find(e=>!e.research);if(!labs.length)return{ok:false,message:'Build a Tech core first'};
  if(!lab||lab.research||labs.some(e=>e.research?.kind===kind))return{ok:false,message:'Research already in progress'};
  const level=kind==='weapons'?p.upgrade:p.armor;if(level>=3)return{ok:false,message:'Research fully upgraded'};
  const cost=(kind==='weapons'?150:125)+100*level;if(p.crystals<cost)return{ok:false,message:'More crystals needed'};
  p.crystals-=cost;const time=(kind==='weapons'?18:16)+level*8;lab.research={kind,level:level+1,total:time,remaining:time};return{ok:true};
 }
 if(['move','attack','mine','stop'].includes(c.type)){
  if(!Array.isArray(c.ids)||c.ids.length>80)return{ok:false,message:'Select a squad'};const ids=new Set(c.ids),selected=own.filter(e=>ids.has(e.id)&&unit(e.type));if(!selected.length)return{ok:false,message:'Select a squad'};
  if(c.type!=='stop'&&(!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<0||c.x>=SIZE||c.y<0||c.y>=SIZE))return{ok:false,message:'Choose a point on the map'};
  const crystal=c.type==='mine'?s.crystals.find(n=>n.id===c.target&&n.left>0&&canSee(s,side,n)):null;if(c.type==='mine'&&!crystal)return{ok:false,message:'Choose a visible crystal field'};
  const target=c.type==='attack'&&c.target!==undefined?s.entities.find(e=>e.id===c.target&&e.side!==side&&e.hp>0&&canSee(s,side,e)):null;if(c.type==='attack'&&c.target!==undefined&&!target)return{ok:false,message:'Choose a visible enemy'};
  if(target&&!selected.some(e=>canTarget(e,target)))return{ok:false,message:TYPES[target.type].flying?'Selected troops cannot attack air':'Selected troops cannot attack this target'};
  selected.forEach((e,i)=>{let x=target?.x??c.x,y=target?.y??c.y;if(selected.length>1&&c.type!=='mine'){x=clamp(x+((i%5)-2)*.5,0,SIZE-.1);y=clamp(y+(Math.floor(i/5)%5-2)*.5,0,SIZE-.1)}e.path=[];e.mine=0;e.patch=null;e.order=c.type==='stop'?{type:'stop'}:{type:c.type,x,y,target:crystal?.id??target?.id};});return{ok:true};
 }
 return{ok:false,message:'Unknown order'};
}
function harvest(s,e,dt){
 const bases=s.entities.filter(b=>b.side===e.side&&b.type==='base'&&!b.build&&b.hp>0);if(!bases.length)return;
 const home=bases.sort((a,b)=>dist(a,e)-dist(b,e))[0];e.home=home.id;
 if(e.carry){if(dist(e,home)<2||move(s,e,home,dt)){s.players[e.side].crystals+=e.carry;s.players[e.side].mined+=e.carry;s.events.push({type:'deposit',side:e.side,x:e.x,y:e.y});e.carry=0;e.path=[]}return}
 const preferred=e.order?.target?s.crystals.find(n=>n.id===e.order.target&&n.left>0&&canSee(s,e.side,n)):null;
 let pool=s.crystals.filter(n=>n.left>0&&canSee(s,e.side,n)&&(!preferred||n.field===preferred.field));
 if(!preferred&&pool.some(n=>dist(n,home)<9))pool=pool.filter(n=>dist(n,home)<9);
 const load=n=>s.entities.filter(w=>w.side===e.side&&w.type==='worker'&&w.hp>0&&w.id!==e.id&&w.patch===n.id&&(!w.order||w.order.type==='mine')).length;
 let n=e.mine>0?pool.find(n=>n.id===e.patch):null;
 if(!n)n=pool.sort((a,b)=>(load(a)*5+dist(e,a)+dist(home,a)*.5)-(load(b)*5+dist(e,b)+dist(home,b)*.5)||a.id-b.id)[0];
 if(!n){e.order=null;e.patch=null;return}if(e.patch!==n.id){e.mine=0;e.path=[]}e.patch=n.id;
 if(dist(e,n)>.8){move(s,e,n,dt);return}
 // One worker extracts from each patch at a time; extra workers queue or spread out.
 if(s.harvesting.has(n.id))return;s.harvesting.add(n.id);e.mine+=dt;
 if(e.mine>=1.8){e.mine=0;e.carry=Math.min(n.left,n.rich?16:8);n.left-=e.carry;e.path=[]}
}
function attacked(s,e){const category=e.type==='base'?'base':e.type==='worker'?'miners':'structures';s.players[e.side].alerts[category]={tick:s.tick,time:s.time,x:e.x,y:e.y}}
function damage(s,att,target){const p=s.players[att.side],d=TYPES[att.type];let amount=(TYPES[target.type].flying?d.airDamage:d.damage)*(1+p.upgrade*.2);if(att.type==='scout'&&target.type==='siege')amount*=1.8;if(att.type==='laser'&&target.type==='scout')amount*=1.6;if(att.type==='siege'&&!unit(target.type))amount*=1.8;const raw=amount;amount*=1/(1+(s.players[target.side].armor||0)*.12);target.hp-=amount;attacked(s,target);if(target.hp<=0)p.kills++;s.events.push({type:'shot',side:att.side,x:att.x,y:att.y,tx:target.x,ty:target.y,kind:att.type,air:!!d.flying,targetAir:!!TYPES[target.type].flying});if(d.splash){for(const e of s.entities)if(e.id!==target.id&&e.side!==att.side&&e.hp>0&&!TYPES[e.type].flying&&dist(e,target)<d.splash){e.hp-=raw*.35/(1+(s.players[e.side].armor||0)*.12);attacked(s,e);if(e.hp<=0)p.kills++}}}
// Commanders use their own vision and remembered structures, never hidden enemy positions.
function bot(s){
 if(!s.practice||s.learning||s.time<s.botAt)return;
 const level=DIFFICULTIES[s.difficulty];s.botAt=s.time+level.pace;
 const own=s.entities.filter(e=>e.side===1&&e.hp>0),bases=own.filter(e=>e.type==='base'&&!e.build),base=bases[0],p=s.players[1],m=s.botMemory;if(!base)return;
 const visible=s.entities.filter(e=>e.side===0&&e.hp>0&&canSee(s,1,e));
 for(const e of visible)if(!unit(e.type))m.structures[e.id]={id:e.id,type:e.type,x:e.x,y:e.y};
 for(const [id,e]of Object.entries(m.structures))if(canSee(s,1,e)&&!visible.some(t=>String(t.id)===id))delete m.structures[id];
 const army=own.filter(e=>unit(e.type)&&e.type!=='worker'&&e.type!=='scout'),miners=own.filter(e=>e.type==='worker');
 const count=k=>own.filter(e=>e.type===k).length+own.reduce((n,e)=>n+e.queue.filter(t=>t===k).length,0);
 const armySize=()=>army.length+own.reduce((n,e)=>n+e.queue.filter(k=>k!=='worker'&&k!=='scout').length,0);
 const train=(producer,kind)=>producer&&producer.queue.length<2&&command(s,1,{type:'train',id:producer.id,kind}).ok;
 const buildNear=(kind,at)=>{for(const [dx,dy]of [[-3,0],[0,-3],[3,0],[0,3],[-4,-4],[4,-4],[-4,4],[4,4],[-6,0],[0,-6],[6,0],[0,6],[-6,-3],[-3,-6],[-6,3],[3,-6],[6,-3],[-3,6],[6,3],[3,6],[-6,-6],[6,-6],[-6,6],[6,6]])if(command(s,1,{type:'build',kind,x:at.x+dx,y:at.y+dy}).ok)return true;return false};
 const factory=own.find(e=>e.type==='factory'&&!e.build);
 // Establish expansions beside discovered reserves. A real miner must travel and build.
 if(m.expansion){const project=m.expansion,worker=miners.find(e=>e.id===project.worker);
  if(!worker||bases.some(b=>dist(b,project)<6)||s.time-project.started>45){if(worker)worker.order=null;m.expansion=null;}
  else {const result=dist(worker,project)<7?command(s,1,{type:'build',kind:'base',x:project.x,y:project.y}):null;
   if(result?.ok){worker.order=null;m.expansion=null;}
   else if(result?.message==='Choose clear ground'){worker.order=null;m.expansion=null;}
   else if(worker.order?.type!=='move')command(s,1,{type:'move',ids:[worker.id],x:project.x,y:project.y});
  }
 }
 if(!m.expansion&&s.difficulty!=='easy'&&s.time>110&&miners.length>=level.workers&&bases.length<3&&!own.some(e=>e.type==='base'&&e.build)&&army.length>=3){
  const nodes=Object.values(p.knownCrystals).filter(n=>n.left>600&&!n.rich&&bases.every(b=>dist(b,n)>12)).sort((a,b)=>dist(a,base)-dist(b,base));
  outer:for(const n of nodes)for(const [dx,dy]of [[-4,0],[4,0],[0,-4],[0,4]]){const at={x:n.x+dx,y:n.y+dy};
   if(at.x<3||at.y<3||at.x>60||at.y>60||s.rocks.some(r=>dist(r,at)<3)||s.crystals.some(r=>dist(r,at)<2.4)||own.some(e=>!unit(e.type)&&dist(e,at)<4))continue;
   const worker=miners.slice().sort((a,b)=>dist(a,at)-dist(b,at))[0];if(worker&&path(s,worker,at).length){m.expansion={...at,worker:worker.id,started:s.time};command(s,1,{type:'move',ids:[worker.id],...at});break outer;}
  }
 }
 // Keep the expansion budget reserved while its miner is on the way.
 let reserve=m.expansion?350:0;
 m.settledBases=m.settledBases||[base.id];
 for(const expansion of bases.filter(b=>!m.settledBases.includes(b.id))){const field=s.crystals.filter(n=>n.left>0&&canSee(s,1,n)).sort((a,b)=>dist(a,expansion)-dist(b,expansion))[0];
  if(field){const transfer=miners.slice().sort((a,b)=>dist(a,expansion)-dist(b,expansion)).slice(0,4);command(s,1,{type:'mine',ids:transfer.map(e=>e.id),x:field.x,y:field.y,target:field.id});m.settledBases.push(expansion.id);}
 }
 if(factory&&s.time>level.techAt+45&&p.crystals-reserve>=260){if(!own.some(e=>e.type==='armory'))buildNear('armory',base);else if(!own.some(e=>e.type==='starport'))buildNear('starport',base);}
 if(factory&&s.time>level.techAt+45&&!own.some(e=>e.type==='starport'))reserve+=260;
 const workerBase=bases.slice().sort((a,b)=>miners.filter(w=>dist(w,a)<10).length-miners.filter(w=>dist(w,b)<10).length)[0];
 if(p.crystals-reserve>=50&&count('worker')<Math.min(24,level.workers+(bases.length-1)*6))train(workerBase,'worker');
 if(!own.some(e=>e.type==='factory'))buildNear('factory',base);
 const pop=supply(s,1);if(pop.cap-pop.used<6&&p.crystals-reserve>=100)buildNear('relay',miners[0]||base);
 if(s.difficulty!=='easy'&&count('scout')===0&&p.crystals-reserve>=75)train(base,'scout');
 if(p.crystals-reserve>=100&&factory&&armySize()<level.armyCap-(s.difficulty==='easy'?2:0)){
  const enemyAir=visible.some(e=>TYPES[e.type].flying),hasArsenal=own.some(e=>e.type==='armory'&&!e.build),hasLab=own.some(e=>e.type==='lab'&&!e.build);
  train(factory,enemyAir&&hasArsenal&&count('guardian')<3?'guardian':hasLab&&count('siege')<3?'siege':'laser');
 }
 if(s.time>level.techAt&&p.crystals-reserve>=220&&!own.some(e=>e.type==='lab'))buildNear('lab',base);
 if(s.time>level.techAt+30&&p.crystals-reserve>=150&&!own.some(e=>e.type==='barracks'))buildNear('barracks',base);
 const bay=own.find(e=>e.type==='barracks'&&!e.build);if(bay&&armySize()<level.armyCap-(s.difficulty==='easy'?2:0)&&p.crystals-reserve>=100)train(bay,count('medic')<Math.max(1,Math.floor(army.length/8))?'medic':'raider');
 if(s.time>level.techAt+45&&p.crystals-reserve>=240){
  const hangar=own.find(e=>e.type==='starport'&&!e.build);
  if(hangar&&armySize()<level.armyCap&&own.filter(e=>TYPES[e.type].flying).length<(s.difficulty==='easy'?2:6))train(hangar,own.some(e=>e.type==='armory'&&!e.build)&&count('interceptor')>=2?'bomber':'interceptor');
 }
 if(p.crystals-reserve>550&&own.some(e=>e.type==='lab'&&!e.build))command(s,1,{type:'upgrade',kind:p.upgrade<3?'weapons':'armor'});
 // Explore expansion fields first, then approach the opponent via a flank.
 const scout=own.find(e=>e.type==='scout'),route=[{x:47,y:55},{x:50,y:37},{x:12,y:28},{x:6,y:6},{x:16,y:8}];
 if(scout){const danger=visible.some(e=>canTarget(e,scout)&&dist(e,scout)<6);if(danger||scout.hp<scout.maxHp*.4)command(s,1,{type:'move',ids:[scout.id],x:base.x,y:base.y});else if(!scout.order||dist(scout,route[m.scoutIndex%route.length])<3){const at=route[m.scoutIndex++%route.length];command(s,1,{type:'move',ids:[scout.id],...at});}}
 if(s.time<m.tacticsAt)return;m.tacticsAt=s.time+4;
 const threat=visible.filter(e=>unit(e.type)&&e.type!=='worker'&&bases.some(b=>dist(b,e)<12)).sort((a,b)=>dist(a,base)-dist(b,base))[0];
 const wounded=army.filter(e=>e.hp<e.maxHp*.3&&dist(e,base)>9);for(const e of wounded)command(s,1,{type:'move',ids:[e.id],x:base.x,y:base.y});
 const ready=army.filter(e=>!wounded.includes(e));if(!ready.length)return;
 if(threat){command(s,1,{type:'attack',ids:ready.map(e=>e.id),x:threat.x,y:threat.y});return;}
 if(s.time<level.attackAt||s.time<m.retreatUntil)return;
 const center={x:ready.reduce((n,e)=>n+e.x,0)/ready.length,y:ready.reduce((n,e)=>n+e.y,0)/ready.length};
 const opposition=visible.filter(e=>unit(e.type)&&canTarget(e,ready[0])&&dist(e,center)<10);
 if(s.difficulty!=='easy'&&dist(center,base)>14&&opposition.reduce((n,e)=>n+e.hp,0)>ready.reduce((n,e)=>n+e.hp,0)*1.4){m.retreatUntil=s.time+12;command(s,1,{type:'move',ids:ready.map(e=>e.id),x:base.x,y:base.y});return;}
 if(ready.length<level.force||s.time<s.botAttackAt)return;s.botAttackAt=s.time+Math.max(6,level.wave);
 const raiders=s.difficulty==='easy'?[]:ready.filter(e=>e.type==='raider').slice(0,3),miner=visible.filter(e=>e.type==='worker').sort((a,b)=>dist(a,center)-dist(b,center))[0];
 if(miner&&raiders.length)command(s,1,{type:'attack',ids:raiders.map(e=>e.id),x:miner.x,y:miner.y,target:miner.id});
 const main=ready.filter(e=>!miner||!raiders.includes(e)),targets=Object.values(m.structures).sort((a,b)=>(a.type==='base'?0:1)-(b.type==='base'?0:1)||dist(a,center)-dist(b,center));
 const target=targets[0]||{x:6,y:6};if(main.length)command(s,1,{type:'attack',ids:(s.difficulty==='easy'?main.slice(0,3):main).map(e=>e.id),x:target.x,y:target.y});
}
function tick(s,dt=STEP){
 if(s.ended)return;dt=clamp(dt,0,.1);s.time+=dt;s.tick++;s.events=[];s.harvesting=new Set();vision(s);bot(s);
 for(const e of s.entities){if(e.hp<=0)continue;if(e.build>0){e.build=Math.max(0,e.build-dt);continue}
  if(e.research){e.research.remaining=Math.max(0,e.research.remaining-dt);if(!e.research.remaining){const r=e.research;s.players[e.side][r.kind==='weapons'?'upgrade':'armor']=r.level;e.research=null;s.events.push({type:'researched',side:e.side,x:e.x,y:e.y,kind:r.kind})}}
  if(e.queue.length){e.progress+=dt;const k=e.queue[0];if(e.progress>=TYPES[k].time){e.progress=0;e.queue.shift();const born=makeEntity(s,k,e.side,clamp(e.x+1.7,0,SIZE-1),clamp(e.y+1.7,0,SIZE-1));if(e.rally){const n=k==='worker'?s.crystals.find(n=>n.id===e.rally.target&&n.left>0):null;born.order=n?{type:'mine',x:n.x,y:n.y,target:n.id}:{type:'move',x:e.rally.x,y:e.rally.y}}s.events.push({type:'trained',side:e.side,x:e.x,y:e.y})}}
  if(e.type==='worker'){if(!e.order||e.order.type==='mine')harvest(s,e,dt);else if(e.order.type==='move'||e.order.type==='attack'){if(move(s,e,e.order,dt)){e.order=null;e.path=[]}}continue}
  const d=TYPES[e.type];e.cool=Math.max(0,e.cool-dt);
  if(d.heal){
   const friends=s.entities.filter(t=>t.id!==e.id&&t.side===e.side&&t.hp>0&&unit(t.type)&&!TYPES[t.type].flying&&t.hp<t.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||dist(e,a)-dist(e,b));
   const patient=friends.find(t=>dist(e,t)<=d.range);if(patient&&e.order?.type!=='move'){if(!e.cool){patient.hp=Math.min(patient.maxHp,patient.hp+d.heal);e.cool=d.cool;s.events.push({type:'heal',side:e.side,x:e.x,y:e.y,tx:patient.x,ty:patient.y,kind:e.type})}continue}
   if(e.order&&['move','attack'].includes(e.order.type)){const follow=e.order.type==='attack'?friends.find(t=>dist(e,t)<d.vision):null;const target=follow||e.order;if(move(s,e,target,dt)&&target===e.order)e.order=null}continue
  }
  if(!d.damage&&!d.airDamage)continue;
  const enemies=s.entities.filter(t=>t.hp>0&&t.side!==e.side&&canTarget(e,t)&&canSee(s,e.side,t));
  const focus=enemies.find(t=>t.id===e.order?.target&&e.order?.type==='attack');if(focus){e.order.x=focus.x;e.order.y=focus.y}
  const inRange=enemies.filter(t=>(!focus||t.id===focus.id)&&dist(e,t)<=d.range+(TYPES[t.type].radius||.3)).sort((a,b)=>(unit(a.type)?0:4)-(unit(b.type)?0:4)||dist(e,a)-dist(e,b));
  if(inRange.length&&e.order?.type!=='move'){if(!e.cool){damage(s,e,inRange[0]);e.cool=d.cool}continue}
  if(unit(e.type)&&e.order&&['move','attack'].includes(e.order.type)){let target=e.order;if(e.order.type==='attack'){const near=enemies.filter(t=>dist(e,t)<d.vision).sort((a,b)=>dist(e,a)-dist(e,b))[0];if(focus||near)target=focus||near}if(move(s,e,target,dt)&&target===e.order)e.order=null}
 }
 // Central crystals surge for three seconds in every twelve-second cycle.
 if(s.time%12>9){for(const e of s.entities)if(unit(e.type)&&!TYPES[e.type].flying&&s.crystals.some(n=>n.rich&&n.left>0&&dist(e,n)<2))e.hp-=7*dt}
 for(const e of s.entities)if(e.hp<=0)s.events.push({type:'destroyed',side:e.side,x:e.x,y:e.y,kind:e.type});
 s.entities=s.entities.filter(e=>e.hp>0);vision(s);
 // Buffer only public visual events so slower friend snapshots retain brief shots and explosions.
 s.visualEvents=(s.visualEvents||[]).filter(e=>s.time-e.time<.8);for(const e of s.events)s.visualEvents.push({...e,fx:s.fxNext++,time:s.time,audience:[0,1].filter(side=>e.side===side||canSee(s,side,e))});s.visualEvents=s.visualEvents.slice(-128);
 const bases=[0,1].map(side=>s.entities.some(e=>e.side===side&&e.type==='base'));
 if(!bases[0]||!bases[1]){s.ended=true;s.winner=bases[0]?0:bases[1]?1:null;s.reason=bases[0]||bases[1]?'All command bases destroyed':'Both command bases destroyed · draw'}
 if(!s.learning&&s.time>=BATTLE_LIMIT&&!s.ended){s.ended=true;s.winner=null;s.reason='Twenty-minute battle limit · draw'}
}
function view(s,side){const p=s.players[side];return{version:VERSION,map:s.map,tick:s.tick,time:s.time,ended:s.ended,winner:s.winner,reason:s.reason,side,practice:s.practice,learning:!!s.learning,difficulty:s.practice?s.difficulty:null,player:{alerts:Object.fromEntries(Object.entries(p.alerts).map(([k,a])=>[k,{...a}])),crystals:p.crystals,upgrade:p.upgrade,armor:p.armor,kills:p.kills,mined:p.mined,...supply(s,side)},entities:s.entities.filter(e=>e.side===side||canSee(s,side,e)).map(e=>({...e,path:[],queue:e.side===side?[...e.queue]:[],order:e.side===side?e.order:null,rally:e.side===side?e.rally:null,research:e.side===side?e.research:null})),crystals:Object.values(p.knownCrystals).map(n=>({...n})),rocks:s.rocks,seen:[...p.seen],visible:Array.from(s.visible[side]),events:s.events.filter(e=>e.side===side||canSee(s,side,e)),visualEvents:(s.visualEvents||[]).filter(e=>e.audience.includes(side)&&(e.side===side||canSee(s,side,e))).map(({audience,...e})=>e)}}
return{VERSION,SIZE,STEP,BATTLE_LIMIT,MAPS,DIFFICULTIES,TYPES,PRODUCERS,unlockMessage,canTarget,create,tick,command,placement,view,path,supply,canSee};
});
