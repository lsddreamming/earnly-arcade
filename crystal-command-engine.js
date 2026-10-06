(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CrystalCommand=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const VERSION=3,SIZE=40,STEP=.05,BATTLE_LIMIT=1200;
const DIFFICULTIES=Object.freeze({easy:{name:'Easy',pace:3.8,workers:8,attackAt:180,force:3,wave:35,armyCap:6,techAt:150},normal:{name:'Normal',pace:2.4,workers:12,attackAt:35,force:5,wave:0,armyCap:80,techAt:70},hard:{name:'Hard',pace:1.6,workers:10,attackAt:25,force:3,wave:0,armyCap:80,techAt:55}});
const TYPES=Object.freeze({
 worker:{name:'Miner',cost:50,hp:45,speed:2.8,range:0,damage:0,time:4,supply:1,vision:5},
 scout:{name:'Scout',cost:75,hp:65,speed:4,range:2.1,damage:8,time:5,supply:1,vision:8,cool:.7},
 laser:{name:'Striker',cost:100,hp:120,speed:2.2,range:4.2,damage:15,time:7,supply:2,vision:6,cool:.9},
 siege:{name:'Siege bot',cost:200,hp:250,speed:1.4,range:6,damage:30,time:11,supply:4,vision:7,cool:1.8},
 base:{name:'Command base',cost:350,hp:1600,time:16,radius:1.5,vision:8},
 factory:{name:'War factory',cost:180,hp:650,time:10,radius:1.1,vision:5},
 turret:{name:'Sentry',cost:130,hp:420,time:9,radius:.8,range:5,damage:18,cool:1,vision:6},
 relay:{name:'Supply relay',cost:100,hp:300,time:7,radius:.8,vision:5},
 lab:{name:'Tech core',cost:220,hp:500,time:12,radius:1,vision:5}
});
const unit=k=>!!TYPES[k]?.supply;
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const key=(x,y)=>y*SIZE+x;
function makeEntity(s,type,side,x,y,built=true){const d=TYPES[type];const e={id:s.next++,type,side,x,y,hp:d.hp,maxHp:d.hp,build:built?0:d.time,queue:[],cool:0,path:[],order:null,carry:0,mine:0,progress:0,patch:null,home:null,rally:null,research:null};s.entities.push(e);return e}
function create({practice=false,difficulty='normal'}={}){
 difficulty=Object.hasOwn(DIFFICULTIES,difficulty)?difficulty:'normal';
 const s={version:VERSION,tick:0,time:0,next:1,ended:false,winner:null,reason:'',practice,difficulty,botAttackAt:0,entities:[],crystals:[],rocks:[],events:[],visualEvents:[],fxNext:1,players:[0,1].map(()=>({crystals:250,upgrade:0,armor:0,alerts:{},kills:0,mined:0,knownCrystals:{},seen:Array(SIZE*SIZE).fill(0)})),botAt:3};
 const fields=[{name:'Home field',points:[[3,6],[5,3],[3,3],[2,5],[2,7],[4,2]],left:2400},
  {name:'Near expansion',points:[[16,7],[16,9],[15,5],[17,6],[17,8],[17,10]],left:2400},
  {name:'Outer expansion',points:[[12,26],[12,28],[11,24],[13,25],[13,27],[13,29]],left:2400}];
 for(const f of fields)for(const side of [0,1])for(const [x,y]of f.points){s.crystals.push({id:s.next++,x:side?39-x:x,y:side?39-y:y,left:f.left,initial:f.left,rich:false,field:f.name+' '+side})}
 for(const [x,y]of [[19,20],[20,19]])s.crystals.push({id:s.next++,x,y,left:3600,initial:3600,rich:true,field:'Central rich field'});
 for(const [x,y]of [[12,12],[13,12],[12,13],[15,18],[15,19],[18,14],[19,14],[9,23],[10,23]]){s.rocks.push({x,y});s.rocks.push({x:39-x,y:39-y})}
 for(const side of[0,1]){const p=side?33:6;makeEntity(s,'base',side,p,p);for(let j=0;j<4;j++)makeEntity(s,'worker',side,p+(j%2)*.7-1,p+Math.floor(j/2)*.7+2)}
 vision(s);return s;
}
function blocked(s,x,y){return x<0||y<0||x>=SIZE||y>=SIZE||s.rocks.some(r=>r.x===x&&r.y===y)}
function path(s,a,b){
 const sx=clamp(Math.floor(a.x),0,39),sy=clamp(Math.floor(a.y),0,39),tx=clamp(Math.floor(b.x),0,39),ty=clamp(Math.floor(b.y),0,39);
 if(blocked(s,tx,ty))return [];
 const start=key(sx,sy),end=key(tx,ty);const open=[start],prev=new Map(),g=new Map([[start,0]]),f=new Map([[start,Math.abs(tx-sx)+Math.abs(ty-sy)]]),closed=new Set();
 while(open.length){open.sort((a,b)=>f.get(a)-f.get(b));const n=open.shift();if(n===end){const out=[{x:b.x,y:b.y}];let at=n;while(at!==start){out.unshift({x:at%SIZE+.5,y:Math.floor(at/SIZE)+.5});at=prev.get(at)}return out}closed.add(n);const x=n%SIZE,y=Math.floor(n/SIZE);
 for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(blocked(s,nx,ny)||closed.has(k))continue;const score=g.get(n)+1;if(score<(g.get(k)??Infinity)){prev.set(k,n);g.set(k,score);f.set(k,score+Math.abs(nx-tx)+Math.abs(ny-ty));if(!open.includes(k))open.push(k)}}}
 return [];
}
function move(s,e,target,dt){if(!e.path.length||dist(e.path[e.path.length-1],target)>.7)e.path=path(s,e,target);if(!e.path.length)return false;let budget=TYPES[e.type].speed*dt;while(e.path.length&&budget>0){const p=e.path[0],d=dist(e,p);if(d<=budget){e.x=p.x;e.y=p.y;budget-=d;e.path.shift()}else{e.x+=(p.x-e.x)/d*budget;e.y+=(p.y-e.y)/d*budget;budget=0}}return dist(e,target)<.65}
function supply(s,side){const list=s.entities.filter(e=>e.side===side&&e.hp>0);return{used:list.reduce((n,e)=>n+(TYPES[e.type].supply||0)+e.queue.reduce((q,k)=>q+(TYPES[k].supply||0),0),0),cap:list.filter(e=>!e.build).reduce((n,e)=>n+(e.type==='base'?16:e.type==='relay'?12:0),0)}}
function vision(s){s.visible=[new Uint8Array(SIZE*SIZE),new Uint8Array(SIZE*SIZE)];for(const e of s.entities){if(e.hp<=0)continue;const r=TYPES[e.type].vision||5;for(let y=Math.max(0,Math.floor(e.y-r));y<Math.min(SIZE,e.y+r+1);y++)for(let x=Math.max(0,Math.floor(e.x-r));x<Math.min(SIZE,e.x+r+1);x++)if(Math.hypot(x+.5-e.x,y+.5-e.y)<=r){s.visible[e.side][key(x,y)]=1;s.players[e.side].seen[key(x,y)]=1}}for(const side of [0,1])for(const n of s.crystals)if(canSee(s,side,n))s.players[side].knownCrystals[n.id]={...n}}
function canSee(s,side,e){return!!s.visible[side]?.[key(clamp(Math.floor(e.x),0,39),clamp(Math.floor(e.y),0,39))]}
function command(s,side,c){
 if(s.ended||!(side===0||side===1)||!c||typeof c!=='object')return{ok:false,message:'Battle unavailable'};
 const p=s.players[side],own=s.entities.filter(e=>e.side===side&&e.hp>0);
 if(['train','build'].includes(c.type)&&!Object.hasOwn(TYPES,c.kind))return{ok:false,message:'Unknown unit or building'};
 if(c.type==='surrender'){s.ended=true;s.winner=1-side;s.reason='Commander surrendered';return{ok:true}}
 if(c.type==='train'){
  const d=TYPES[c.kind],producer=own.find(e=>e.id===c.id);if(!d||!unit(c.kind)||!producer||producer.build)return{ok:false,message:'Select a completed base or factory'};
  if(!((producer.type==='base'&&['worker','scout'].includes(c.kind))||(producer.type==='factory'&&['laser','siege'].includes(c.kind))))return{ok:false,message:'That unit needs a different building'};
  if(c.kind==='siege'&&!own.some(e=>e.type==='lab'&&!e.build))return{ok:false,message:'Build a Tech core for siege bots'};
  if(producer.queue.length>=5)return{ok:false,message:'Queue full'};const pop=supply(s,side);if(pop.used+d.supply>pop.cap)return{ok:false,message:'Build a Supply relay'};
  if(own.filter(e=>unit(e.type)).length+own.reduce((n,e)=>n+e.queue.length,0)>=80)return{ok:false,message:'Robot limit reached'};
  if(p.crystals<d.cost)return{ok:false,message:'More crystals needed'};p.crystals-=d.cost;producer.queue.push(c.kind);return{ok:true};
 }
 if(c.type==='build'){
  const d=TYPES[c.kind];if(!d||unit(c.kind)||!Number.isFinite(c.x)||!Number.isFinite(c.y))return{ok:false,message:'Invalid building'};
  const x=clamp(c.x,1.5,37.5),y=clamp(c.y,1.5,37.5),at={x,y};if(!canSee(s,side,at))return{ok:false,message:'Scout this location first'};
  if(!own.some(e=>e.type==='worker'&&dist(e,at)<8))return{ok:false,message:'Move a Miner nearby to build'};
  if(blocked(s,Math.floor(x),Math.floor(y))||s.entities.some(e=>!unit(e.type)&&dist(e,at)<(TYPES[e.type].radius||1)+d.radius+.35)||s.crystals.some(n=>dist(n,at)<d.radius+.8)||s.rocks.some(n=>dist(n,at)<d.radius+.7))return{ok:false,message:'Choose clear ground'};
  if(own.filter(e=>!unit(e.type)).length>=24)return{ok:false,message:'Building limit reached'};
  if(p.crystals<d.cost)return{ok:false,message:'More crystals needed'};p.crystals-=d.cost;makeEntity(s,c.kind,side,x,y,false);return{ok:true};
 }
 if(c.type==='rally'){
  const producer=own.find(e=>e.id===c.id&&!e.build&&['base','factory'].includes(e.type));if(!producer)return{ok:false,message:'Select a completed base or factory'};
  if(!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<0||c.x>=SIZE||c.y<0||c.y>=SIZE||blocked(s,Math.floor(c.x),Math.floor(c.y)))return{ok:false,message:'Choose clear ground for the rally point'};
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
  if(c.type!=='stop'&&(!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<0||c.x>=40||c.y<0||c.y>=40))return{ok:false,message:'Choose a point on the map'};
  const crystal=c.type==='mine'?s.crystals.find(n=>n.id===c.target&&n.left>0&&canSee(s,side,n)):null;if(c.type==='mine'&&!crystal)return{ok:false,message:'Choose a visible crystal field'};
  const target=c.type==='attack'&&c.target!==undefined?s.entities.find(e=>e.id===c.target&&e.side!==side&&e.hp>0&&canSee(s,side,e)):null;if(c.type==='attack'&&c.target!==undefined&&!target)return{ok:false,message:'Choose a visible enemy'};
  selected.forEach((e,i)=>{let x=target?.x??c.x,y=target?.y??c.y;if(selected.length>1&&c.type!=='mine'){x=clamp(x+((i%5)-2)*.5,0,39.9);y=clamp(y+(Math.floor(i/5)%5-2)*.5,0,39.9)}e.path=[];e.mine=0;e.patch=null;e.order=c.type==='stop'?{type:'stop'}:{type:c.type,x,y,target:crystal?.id??target?.id};});return{ok:true};
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
function damage(s,att,target){const p=s.players[att.side],d=TYPES[att.type];let amount=d.damage*(1+p.upgrade*.2);if(att.type==='scout'&&target.type==='siege')amount*=1.8;if(att.type==='laser'&&target.type==='scout')amount*=1.6;if(att.type==='siege'&&!unit(target.type))amount*=1.8;const raw=amount;amount*=1/(1+(s.players[target.side].armor||0)*.12);target.hp-=amount;attacked(s,target);if(target.hp<=0)p.kills++;s.events.push({type:'shot',side:att.side,x:att.x,y:att.y,tx:target.x,ty:target.y,kind:att.type});if(att.type==='siege'){for(const e of s.entities)if(e.id!==target.id&&e.side!==att.side&&e.hp>0&&dist(e,target)<1.25){e.hp-=raw*.35/(1+(s.players[e.side].armor||0)*.12);attacked(s,e);if(e.hp<=0)p.kills++}}}
function bot(s){
 if(!s.practice||s.time<s.botAt)return;const level=DIFFICULTIES[s.difficulty];s.botAt=s.time+level.pace;
 const own=s.entities.filter(e=>e.side===1&&e.hp>0),base=own.find(e=>e.type==='base'&&!e.build),factory=own.find(e=>e.type==='factory'&&!e.build),p=s.players[1];if(!base)return;
 const miners=own.filter(e=>e.type==='worker').length;
 if(miners<level.workers)command(s,1,{type:'train',id:base.id,kind:'worker'});
 if(!own.some(e=>e.type==='factory'))command(s,1,{type:'build',kind:'factory',x:30,y:32});
 if(factory){if(own.filter(e=>unit(e.type)&&e.type!=='worker').length+factory.queue.length<level.armyCap)command(s,1,{type:'train',id:factory.id,kind:own.some(e=>e.type==='lab'&&!e.build)&&own.filter(e=>e.type==='siege').length<3?'siege':'laser'});if(s.time>level.techAt&&!own.some(e=>e.type==='lab'))command(s,1,{type:'build',kind:'lab',x:32,y:30})}
 const pop=supply(s,1);if(pop.cap-pop.used<5){for(const [x,y]of [[29,35],[26,33],[33,27],[28,28],[36,30],[36,35]]){if(command(s,1,{type:'build',kind:'relay',x,y}).ok)break}}
 const army=own.filter(e=>unit(e.type)&&e.type!=='worker');if(s.time>level.attackAt&&s.time>=s.botAttackAt&&army.length>=level.force){s.botAttackAt=s.time+level.wave;const target=s.entities.filter(e=>e.side===0&&e.type==='base')[0]||{x:6,y:6};command(s,1,{type:'attack',ids:(s.difficulty==='easy'?army.slice(0,3):army).map(e=>e.id),x:target.x,y:target.y})}
 if(p.crystals>550&&own.some(e=>e.type==='lab'&&!e.build)){if(p.upgrade<3)command(s,1,{type:'upgrade',kind:'weapons'});else if(p.armor<3)command(s,1,{type:'upgrade',kind:'armor'})}
 if(s.time>110&&p.crystals>600&&!own.some(e=>e.type==='base'&&e.x<30)){const worker=own.find(e=>e.type==='worker');if(worker){const at={x:26,y:30};if(dist(worker,at)>2)command(s,1,{type:'move',ids:[worker.id],...at});else command(s,1,{type:'build',kind:'base',...at})}}
}
function tick(s,dt=STEP){
 if(s.ended)return;dt=clamp(dt,0,.1);s.time+=dt;s.tick++;s.events=[];s.harvesting=new Set();vision(s);bot(s);
 for(const e of s.entities){if(e.hp<=0)continue;if(e.build>0){e.build=Math.max(0,e.build-dt);continue}
  if(e.research){e.research.remaining=Math.max(0,e.research.remaining-dt);if(!e.research.remaining){const r=e.research;s.players[e.side][r.kind==='weapons'?'upgrade':'armor']=r.level;e.research=null;s.events.push({type:'researched',side:e.side,x:e.x,y:e.y,kind:r.kind})}}
  if(e.queue.length){e.progress+=dt;const k=e.queue[0];if(e.progress>=TYPES[k].time){e.progress=0;e.queue.shift();const born=makeEntity(s,k,e.side,clamp(e.x+1.7,0,39),clamp(e.y+1.7,0,39));if(e.rally){const n=k==='worker'?s.crystals.find(n=>n.id===e.rally.target&&n.left>0):null;born.order=n?{type:'mine',x:n.x,y:n.y,target:n.id}:{type:'move',x:e.rally.x,y:e.rally.y}}s.events.push({type:'trained',side:e.side,x:e.x,y:e.y})}}
  if(e.type==='worker'){if(!e.order||e.order.type==='mine')harvest(s,e,dt);else if(e.order.type==='move'||e.order.type==='attack'){if(move(s,e,e.order,dt)){e.order=null;e.path=[]}}continue}
  const d=TYPES[e.type];if(!d.damage)continue;e.cool=Math.max(0,e.cool-dt);
  const enemies=s.entities.filter(t=>t.hp>0&&t.side!==e.side&&canSee(s,e.side,t));
  const focus=enemies.find(t=>t.id===e.order?.target&&e.order?.type==='attack');if(focus){e.order.x=focus.x;e.order.y=focus.y}
  const inRange=enemies.filter(t=>(!focus||t.id===focus.id)&&dist(e,t)<=d.range+(TYPES[t.type].radius||.3)).sort((a,b)=>(unit(a.type)?0:4)-(unit(b.type)?0:4)||dist(e,a)-dist(e,b));
  if(inRange.length&&e.order?.type!=='move'){if(!e.cool){damage(s,e,inRange[0]);e.cool=d.cool}continue}
  if(unit(e.type)&&e.order&&['move','attack'].includes(e.order.type)){let target=e.order;if(e.order.type==='attack'){const near=enemies.filter(t=>dist(e,t)<d.vision).sort((a,b)=>dist(e,a)-dist(e,b))[0];if(focus||near)target=focus||near}if(move(s,e,target,dt)&&target===e.order)e.order=null}
 }
 // Central crystals surge for three seconds in every twelve-second cycle.
 if(s.time%12>9){for(const e of s.entities)if(unit(e.type)&&s.crystals.some(n=>n.rich&&n.left>0&&dist(e,n)<2))e.hp-=7*dt}
 for(const e of s.entities)if(e.hp<=0)s.events.push({type:'destroyed',side:e.side,x:e.x,y:e.y,kind:e.type});
 s.entities=s.entities.filter(e=>e.hp>0);vision(s);
 // Buffer only public visual events so slower friend snapshots retain brief shots and explosions.
 s.visualEvents=(s.visualEvents||[]).filter(e=>s.time-e.time<.8);for(const e of s.events)s.visualEvents.push({...e,fx:s.fxNext++,time:s.time,audience:[0,1].filter(side=>e.side===side||canSee(s,side,e))});s.visualEvents=s.visualEvents.slice(-128);
 const bases=[0,1].map(side=>s.entities.some(e=>e.side===side&&e.type==='base'));
 if(!bases[0]||!bases[1]){s.ended=true;s.winner=bases[0]?0:bases[1]?1:null;s.reason=bases[0]||bases[1]?'All command bases destroyed':'Both command bases destroyed · draw'}
 if(s.time>=BATTLE_LIMIT&&!s.ended){s.ended=true;s.winner=null;s.reason='Twenty-minute battle limit · draw'}
}
function view(s,side){const p=s.players[side];return{version:VERSION,tick:s.tick,time:s.time,ended:s.ended,winner:s.winner,reason:s.reason,side,practice:s.practice,difficulty:s.practice?s.difficulty:null,player:{alerts:Object.fromEntries(Object.entries(p.alerts).map(([k,a])=>[k,{...a}])),crystals:p.crystals,upgrade:p.upgrade,armor:p.armor,kills:p.kills,mined:p.mined,...supply(s,side)},entities:s.entities.filter(e=>e.side===side||canSee(s,side,e)).map(e=>({...e,path:[],queue:e.side===side?[...e.queue]:[],order:e.side===side?e.order:null,rally:e.side===side?e.rally:null,research:e.side===side?e.research:null})),crystals:Object.values(p.knownCrystals).map(n=>({...n})),rocks:s.rocks,seen:[...p.seen],visible:Array.from(s.visible[side]),events:s.events.filter(e=>e.side===side||canSee(s,side,e)),visualEvents:(s.visualEvents||[]).filter(e=>e.audience.includes(side)&&(e.side===side||canSee(s,side,e))).map(({audience,...e})=>e)}}
return{VERSION,SIZE,STEP,BATTLE_LIMIT,DIFFICULTIES,TYPES,create,tick,command,view,path,supply,canSee};
});
