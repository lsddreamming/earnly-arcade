/* Spuddy Defense v1. Pure fixed-step simulation; shared with the verifier.
 * No DOM, wall clock, network, cosmetic randomness or client score inputs.
 * A future versus host can run two isolated instances and exchange commands. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SpuddyDefense=api;})(globalThis,function(){
 'use strict';
 const VERSION=1,DT=1/30,W=960,H=600,MAX_ENEMIES=240,MAX_TOWERS=64;
 const MAPS=[
  {id:'meadows',name:'Beginner Meadows',subtitle:'Long bends. Big possibilities.',unlock:0,colors:['#76c759','#4b984c','#e5bc79','#b18a59'],path:[[0,145],[205,145],[205,390],[420,390],[420,175],[670,175],[670,450],[960,450]],props:[[90,340,45],[340,80,30],[550,490,38],[830,100,48]]},
  {id:'city',name:'Spuddy City',subtitle:'Busy blocks and sharp corners.',unlock:8,colors:['#597785','#3b5b6c','#758d9c','#344b60'],path:[[0,100],[360,100],[360,290],[145,290],[145,490],[580,490],[580,125],[820,125],[820,400],[960,400]],props:[[510,240,48],[720,520,32],[70,190,25],[900,70,30]]},
  {id:'tropical',name:'Tropical Trouble',subtitle:'A sunny loop around the lagoon.',unlock:16,colors:['#69c4a1','#2da77e','#f3d89a','#c8a96a'],path:[[0,460],[180,460],[180,150],[440,150],[440,430],[720,430],[720,130],[960,130]],props:[[325,310,48],[590,250,55],[850,480,44],[80,65,25]]},
  {id:'factory',name:'Frozen Factory',subtitle:'Icy switchbacks. Warm cannons.',unlock:24,colors:['#b1d6df','#81b4c7','#e6f1f1','#809daf'],path:[[0,100],[760,100],[760,270],[240,270],[240,480],[960,480]],props:[[130,350,35],[500,390,32],[870,180,35],[480,560,22]]},
  {id:'neon',name:'Neon Nightmare',subtitle:'Short roads. Serious strategy.',unlock:32,colors:['#252850','#191d3b','#664f9b','#a477cf'],path:[[0,300],[170,300],[300,120],[510,120],[510,440],[730,440],[825,260],[960,260]],props:[[95,90,28],[350,300,30],[640,240,42],[895,495,35]]}
 ];
 const TOWERS=[
  {id:'sprayer',name:'Spud Sprayer',short:'Sprayer',color:'#81df77',icon:'✿',cost:120,damage:6,rate:.55,range:140,kind:'seed',description:'Cheap, quick seeds. Weak against armor.',paths:[['Hearty seeds','Piercing peas','Garden storm'],['Long barrel','Scout goggles','Double harvest']],effect:['More damage; tier 2 pierces armor.','More range; tier 2 reveals stealth.']},
  {id:'cannon',name:'Blast Cannon',short:'Cannon',color:'#ffac60',icon:'✹',cost:260,damage:27,rate:1.6,range:150,splash:48,kind:'blast',description:'Heavy splash clears crowds. Slow reload.',paths:[['Heavy shell','Siege rounds','Crater maker'],['Wide blast','Quick fuse','Cluster boom']],effect:['Stronger shells punch through armor.','Larger blasts and a faster reload.']},
  {id:'frost',name:'Frost Fan',short:'Frost',color:'#8ce6ff',icon:'❄',cost:210,damage:2,rate:1,range:118,splash:50,slow:.52,detect:true,kind:'frost',description:'Chills groups and reveals ghosts. Low damage.',paths:[['Deep chill','Permafrost','Absolute zero'],['Wide breeze','Ice shards','Blizzard']],effect:['Stronger, longer slows; bosses resist.','More coverage and shard damage.']},
  {id:'laser',name:'Laser Spud',short:'Laser',color:'#ff79a8',icon:'◈',cost:420,damage:32,rate:.85,range:185,pierce:true,detect:true,kind:'laser',description:'Armor-piercing beam. Great against brutes.',paths:[['Hot lens','Core melter','Solar lance'],['Far sight','Rapid pulse','Prism array']],effect:['More damage, especially against bosses.','Longer range and faster pulses.']},
  {id:'arc',name:'Arc Coil',short:'Arc Coil',color:'#c7a1ff',icon:'ϟ',cost:380,damage:14,rate:1,range:145,chain:4,detect:true,kind:'arc',description:'Electric arcs jump across packs and break shields.',paths:[['High voltage','Overcharge','Thunderhead'],['Long jump','More links','Chain reaction']],effect:['More damage; shields take extra damage.','Electricity jumps farther to more enemies.']},
  {id:'rapid',name:'Rapid Launcher',short:'Rapid',color:'#ffe283',icon:'»',cost:500,damage:5,rate:.13,range:155,kind:'rapid',description:'A hail of seeds. Needs help against armor.',paths:[['Twin feed','AP seeds','Seed hurricane'],['Long sight','Turbo motor','Overdrive']],effect:['Heavier shots; tier 2 breaks armor.','Longer reach and relentless fire.']},
  {id:'bombardier',name:'Bombardier',short:'Mortar',color:'#ff8579',icon:'◎',cost:640,damage:65,rate:2.8,range:350,minRange:80,splash:65,pierce:true,kind:'mortar',description:'Huge long-range blasts. Cannot hit nearby targets.',paths:[['Big payload','Bunker buster','Meteor shell'],['Wide crater','Fast loader','Carpet blast']],effect:['Enormous damage against hardened targets.','Bigger area and shorter reload.']},
  {id:'commander',name:'Spuddy Commander',short:'Commander',color:'#f8d36b',icon:'♛',cost:1800,damage:85,rate:1.2,range:190,splash:36,pierce:true,detect:true,kind:'command',description:'Elite firepower. Boosts nearby towers by 12%.',paths:[['Elite training','Royal guard','Spud supremacy'],['Field orders','Wide command','Rally the patch']],effect:['Stronger armor-piercing cannon.','Wider support aura and faster fire.']}
 ];
 const ENEMIES=[
  {id:'pip',name:'Pip',color:'#74dfff',hp:12,speed:58,value:4,lives:1,at:1,tip:'The first Glooplings! Sprayers make short work of them.'},
  {id:'zip',name:'Zip',color:'#ffe16e',hp:16,speed:105,value:5,lives:1,at:3,tip:'Zips are quick. Put towers near bends or use Frost.'},
  {id:'puff',name:'Puff',color:'#f3a0df',hp:35,speed:48,value:7,lives:2,at:5,tip:'Puffs are chunky. A Cannon makes a big difference.'},
  {id:'split',name:'Twinsie',color:'#d19bff',hp:45,speed:52,value:6,lives:2,split:['pip','pip'],at:7,tip:'Twinsies split into Pips. Keep a backup tower near the exit.'},
  {id:'tin',name:'Tin Tot',color:'#a2b5c7',hp:80,speed:42,armor:4,value:9,lives:3,at:10,tip:'Tin Tots wear armor. Lasers, Cannons and piercing upgrades help.'},
  {id:'moss',name:'Moss Munch',color:'#93dc7e',hp:90,speed:46,regen:8,value:10,lives:3,at:13,tip:'Moss Munches regenerate. Focus damage before they recover.'},
  {id:'bubble',name:'Bubble Buddy',color:'#79aeff',hp:70,speed:52,shield:65,value:11,lives:3,at:16,tip:'Shields soak up hits. Arc Coils break them twice as fast.'},
  {id:'ghost',name:'Sneaky Boo',color:'#d9d2f5',hp:50,speed:64,stealth:true,value:10,lives:2,at:20,tip:'Stealth! Frost, Lasers, Arc Coils or Scout goggles can see Boos.'},
  {id:'dash',name:'Dash Bean',color:'#ffad5d',hp:110,speed:90,value:12,lives:3,at:24,tip:'Dash Beans sprint when hurt. Chilling them keeps them under control.'},
  {id:'nest',name:'Gloop Nest',color:'#ba81ef',hp:190,speed:38,split:['split','zip','zip'],value:13,lives:5,at:28,tip:'Nests burst into smaller Gloops. Splash and chain attacks shine.'},
  {id:'chrome',name:'Chrome Chonk',color:'#98d3db',hp:300,speed:38,armor:10,shield:100,value:18,lives:6,at:34,tip:'Chrome Chonks have armor AND shields. Combine Arc and Laser.'},
  {id:'phantom',name:'Phantom Plum',color:'#b4a2ff',hp:180,speed:60,stealth:true,regen:12,value:16,lives:4,at:40,tip:'Phantom Plums are hidden regenerators. Upgrade your detectors.'},
  {id:'king',name:'King Wobble',color:'#d68aff',hp:1000,speed:26,armor:3,value:160,lives:20,boss:true,at:20,tip:'King Wobble shields and calls helpers at two-thirds health, then rushes at one-third.'},
  {id:'queen',name:'Queen Glimmer',color:'#ff82b7',hp:2200,speed:29,armor:6,value:280,lives:35,boss:true,at:50,tip:'Queen Glimmer has three phases. Focus strong targets and protect the exit.'}
 ];
 const ENEMY=Object.fromEntries(ENEMIES.map(e=>[e.id,e]));
 const STAT_CACHE=new Map();
 const MODES={easy:{name:'Easy',hp:.8,money:800,lives:150,waves:40,unlock:0},normal:{name:'Normal',hp:1,money:650,lives:100,waves:60,unlock:0},hard:{name:'Hard',hp:1.25,money:600,lives:60,waves:100,unlock:20},endless:{name:'Endless',hp:1.1,money:700,lives:100,waves:Infinity,unlock:40}};
 // Ten authored encounter shapes per act. New mechanics have dedicated introductions.
 const PATTERNS=['parade','rush','swarm','heavy','alternating','shieldwall','splitparty','sneak','mixed','boss'];
 const clone=o=>JSON.parse(JSON.stringify(o));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function hash(text){let n=2166136261;for(const ch of text)n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;}
 function challenge(kind,date=new Date().toISOString().slice(0,10)){let d=new Date(date+'T12:00:00Z');if(!Number.isFinite(+d))throw Error('INVALID_DATE');if(kind==='weekly')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const key=d.toISOString().slice(0,10),seed=hash(kind+key);return {id:kind+':'+key,kind,seed,map:MAPS[seed%5].id,mode:'normal',modifier:['swift','sturdy','budget'][seed%3],goal:kind==='weekly'?50:20};}
 function getMap(id){return MAPS.find(m=>m.id===id)||MAPS[0];}
 function geometry(map){const path=map.path,segments=[];let length=0;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);segments.push({a,b,l,start:length});length+=l;}return {segments,length};}
 function point(g,d){for(const s of g.segments)if(d<=s.start+s.l){const q=clamp((d-s.start)/s.l,0,1);return {x:s.a[0]+(s.b[0]-s.a[0])*q,y:s.a[1]+(s.b[1]-s.a[1])*q};}const b=g.segments[g.segments.length-1].b;return {x:b[0],y:b[1]};}
 function segmentDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],q=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(x-a[0]-q*dx,y-a[1]-q*dy);}
 function stats(t){const b=TOWERS[t.type],a=t.a||0,c=t.b||0,key=t.type+":"+a+":"+c;if(STAT_CACHE.has(key))return STAT_CACHE.get(key);const result={...b,damage:b.damage*Math.pow(1.75,a)*(b.kind==='frost'?1+c*.8:1),range:b.range*(1+c*.13),rate:b.rate/((1+c*.18)*(b.kind==='rapid'?1+a*.1:1)),splash:(b.splash||0)*(1+c*.25),chain:(b.chain||0)+c*2,jump:100+c*25,slow:b.slow?Math.max(.2,b.slow-a*.09):0,pierce:b.pierce||a>=2,detect:b.detect||c>=2,bossBonus:b.kind==='laser'?1+a*.25:1};STAT_CACHE.set(key,result);return result;}
 function upgradeCost(t,path){const level=t[path];return Math.ceil(TOWERS[t.type].cost*[.7,1.35,2.6][level]);}
 function wavePlan(w,seed=1){const unlocked=ENEMIES.filter(e=>!e.boss&&e.at<=w),pattern=PATTERNS[(w-1)%10];let count=Math.min(110,8+Math.floor(w*1.4)),types=[];const latest=unlocked[unlocked.length-1];for(let i=0;i<count;i++){
   let e=unlocked[(i*7+w+seed)%unlocked.length];
   if(pattern==='rush')e=unlocked.find(e=>e.id===(w>=24?'dash':'zip'))||unlocked[0];
   if(pattern==='heavy')e=unlocked.filter(e=>e.armor)[Math.floor(i/4)%Math.max(1,unlocked.filter(e=>e.armor).length)]||latest;
   if(pattern==='swarm')e=unlocked[i%Math.min(4,unlocked.length)];
   if(pattern==='shieldwall'&&w>=16)e=unlocked.find(e=>e.id==='bubble');
   if(pattern==='splitparty'&&w>=7)e=unlocked.find(e=>e.id===(w>=28?'nest':'split'));
   if(pattern==='sneak'&&w>=20)e=unlocked.find(e=>e.id==='ghost');
   if(w===latest.at)e=i%3===0?latest:unlocked[0];
   types.push(e.id);
  }
  if(w%10===0&&w>=20)types.splice(Math.floor(count/2),0,w>=50?'queen':'king');
  return {types,interval:Math.max(.18,.62-w*.004),pattern,tip:ENEMIES.find(e=>e.at===w)?.tip||({rush:'Fast movers incoming. Cover the corners.',heavy:'Armor convoy. Bring piercing firepower.',boss:w>=20?'Boss wave! Check your strongest-target towers.':'A mixed pack. Spend your upgrade money.'}[pattern]||'Build around bends to hit the same enemy twice.')};
 }
 function create(options={}){
  const map=getMap(options.map),mode=MODES[options.mode]?options.mode:'normal',rules=MODES[mode],g=geometry(map);
  let s={version:VERSION,map:map.id,mode,seed:(options.seed>>>0)||1,challenge:options.challenge||null,tick:0,wave:0,completed:0,phase:'build',money:rules.money,lives:rules.lives,towers:[],enemies:[],queue:[],spawnTick:0,waveTick:0,nextId:1,kills:0,bosses:0,damage:0,mastery:Array(8).fill(0),effects:[],maxEnemies:0};
  if(s.challenge?.modifier==='budget')s.money=Math.floor(s.money*.8);
  function canPlace(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&x>=28&&x<=W-28&&y>=28&&y<=H-28&&!g.segments.some(v=>segmentDistance(x,y,v.a,v.b)<46)&&!map.props.some(p=>Math.hypot(x-p[0],y-p[1])<p[2]+22)&&!s.towers.some(t=>Math.hypot(x-t.x,y-t.y)<48)&&s.towers.length<MAX_TOWERS;}
  function action(a){if(!a||typeof a!=='object'||['won','lost'].includes(s.phase))return false;
   if(a.kind==='place'){if(!Number.isInteger(a.type)||!TOWERS[a.type]||!Number.isInteger(a.x)||!Number.isInteger(a.y)||!canPlace(a.x,a.y)||s.money<TOWERS[a.type].cost)return false;s.money-=TOWERS[a.type].cost;s.towers.push({id:s.nextId++,type:a.type,x:a.x,y:a.y,a:0,b:0,spent:TOWERS[a.type].cost,cooldown:0,target:'first',angle:0,kills:0,flash:0});return true;}
   if(a.kind==='wave'){if(s.phase!=='build')return false;s.wave++;s.queue=wavePlan(s.wave,s.seed).types;s.spawnTick=0;s.waveTick=0;s.phase='wave';return true;}
   const t=s.towers.find(t=>t.id===a.id);if(!t)return false;
   if(a.kind==='target'&&['first','last','strong','near'].includes(a.value)){t.target=a.value;return true;}
   if(a.kind==='sell'){s.money+=Math.floor(t.spent*.7);s.towers=s.towers.filter(v=>v!==t);return true;}
   if(a.kind==='upgrade'&&['a','b'].includes(a.path)){const other=a.path==='a'?'b':'a',cost=upgradeCost(t,a.path);if(t[a.path]>=3||(t[a.path]>=2&&t[other]>=3)||s.money<cost)return false;s.money-=cost;t.spent+=cost;t[a.path]++;return true;}
   return false;
  }
  function spawn(id,d=0){if(s.enemies.length>=MAX_ENEMIES)return false;const def=ENEMY[id];const growth=1+Math.max(0,s.wave-def.at)*.045+Math.pow(Math.max(0,s.wave-60),1.65)*.003;
   const scale=growth*rules.hp*(s.challenge?.modifier==='sturdy'?1.2:1)*(def.boss?1+Math.max(0,s.wave-def.at)*.055:1);const e={id:s.nextId++,type:id,hp:def.hp*scale,maxHp:def.hp*scale,shield:(def.shield||0)*scale,d,slowUntil:0,slow:1,hitTick:-999,stage:0,dead:false};Object.assign(e,point(g,d));s.enemies.push(e);s.maxEnemies=Math.max(s.maxEnemies,s.enemies.length);return e;
  }
  function effect(v){if(s.effects.length>=120)s.effects.shift();s.effects.push({...v,life:12});}
  function hit(e,amount,t,st){if(e.dead)return;const def=ENEMY[e.type];let damage=amount*(def.boss?(st.bossBonus||1):1);if(e.shield>0){const mult=st.kind==='arc'?2.5:1,used=Math.min(e.shield,damage*mult);e.shield-=used;damage-=used/mult;}damage=Math.max(0,damage-(st.pierce?0:(def.armor||0)));if(damage===0&&e.shield<=0)damage=.5;e.hp-=damage;s.damage+=damage;e.hitTick=s.tick;
   if(st.slow){e.slow=Math.min(e.slow,def.boss?Math.max(.65,st.slow):st.slow);e.slowUntil=s.tick+60+(t.a||0)*15;}
   if(e.hp<=0){e.dead=true;s.kills++;t.kills++;s.mastery[t.type]++;s.money+=def.value;effect({kind:'pop',x:e.x,y:e.y,color:def.color,r:def.boss?45:18});if(def.boss)s.bosses++;if(def.split)for(const child of def.split)spawn(child,Math.max(0,e.d-14));}
  }
  function step(){if(s.phase!=='wave')return;s.tick++;s.waveTick++;s.effects=s.effects.filter(e=>--e.life>0);const interval=Math.max(.18,.62-s.wave*.004);
   if(s.queue.length&&s.tick>=s.spawnTick&&s.enemies.length<MAX_ENEMIES-6){spawn(s.queue.shift());s.spawnTick=s.tick+Math.ceil(interval/DT);}
   for(const e of s.enemies.slice()){if(e.dead)continue;const def=ENEMY[e.type];if(e.slowUntil<s.tick){e.slow=1;}if(def.regen&&s.tick-e.hitTick>75)e.hp=Math.min(e.maxHp,e.hp+def.regen*DT);
    if(def.boss){const stage=e.hp/e.maxHp<.33?2:e.hp/e.maxHp<.67?1:0;if(stage>e.stage){e.stage=stage;if(stage===1){e.shield+=e.maxHp*.12;for(let i=0;i<5;i++)spawn('zip',Math.max(0,e.d-i*12));}effect({kind:'burst',x:e.x,y:e.y,color:def.color,r:65});}}
    let speed=def.speed*(1+Math.min(.65,Math.max(0,s.wave-40)*.003));if(def.id==='dash'&&e.hp<e.maxHp*.5)speed*=1.5;if(e.stage===2)speed*=1.5;if(s.challenge?.modifier==='swift')speed*=1.15;e.d+=speed*e.slow*DT;Object.assign(e,point(g,e.d));if(e.d>=g.length){e.dead=true;s.lives=Math.max(0,s.lives-def.lives);effect({kind:'leak',x:e.x-12,y:e.y,color:'#ff6b76',r:30});}
   }
   for(const t of s.towers){t.flash=Math.max(0,t.flash-1);t.cooldown-=DT;if(t.cooldown>0)continue;const st=stats(t);let targets=s.enemies.filter(e=>!e.dead&&(!ENEMY[e.type].stealth||st.detect)&&Math.hypot(e.x-t.x,e.y-t.y)<=st.range&&Math.hypot(e.x-t.x,e.y-t.y)>=(st.minRange||0));
    targets.sort((a,b)=>t.target==='strong'?(b.hp+b.shield)-(a.hp+a.shield):t.target==='last'?a.d-b.d:t.target==='near'?Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y):b.d-a.d);const target=targets[0];if(!target)continue;
    const boost=s.towers.some(c=>c!==t&&c.type===7&&Math.hypot(c.x-t.x,c.y-t.y)<stats(c).range)?1.12:1;t.cooldown=st.rate/boost;t.flash=5;t.angle=Math.atan2(target.y-t.y,target.x-t.x);const tx=target.x,ty=target.y;hit(target,st.damage*boost,t,st);effect({kind:st.kind,x:t.x,y:t.y,tx,ty,color:st.color,r:st.splash||5});
    if(st.splash)for(const e of s.enemies.slice())if(e!==target&&!e.dead&&(!ENEMY[e.type].stealth||st.detect)&&Math.hypot(e.x-tx,e.y-ty)<=st.splash)hit(e,st.damage*.75*boost,t,st);
    if(st.chain){let prev=target;const struck=new Set([target.id]);for(let i=1;i<st.chain;i++){const next=s.enemies.filter(e=>!e.dead&&!struck.has(e.id)&&Math.hypot(e.x-prev.x,e.y-prev.y)<st.jump).sort((a,b)=>Math.hypot(a.x-prev.x,a.y-prev.y)-Math.hypot(b.x-prev.x,b.y-prev.y))[0];if(!next)break;effect({kind:'arc',x:prev.x,y:prev.y,tx:next.x,ty:next.y,color:st.color});hit(next,st.damage*Math.pow(.86,i)*boost,t,st);struck.add(next.id);prev=next;}}
   }
   s.enemies=s.enemies.filter(e=>!e.dead);
   if(s.lives<=0){s.phase='lost';s.queue=[];return;}
   if(!s.queue.length&&!s.enemies.length){s.completed=s.wave;s.money+=65+Math.floor(s.wave*2.5);const goal=s.challenge?.goal||rules.waves;s.phase=s.completed>=goal?'won':'build';effect({kind:'clear',x:480,y:240,color:'#fff4a8',r:80});}
  }
  function snapshot(){const out=clone(s);out.effects=[];return out;}
  function restore(v){if(!v||v.version!==VERSION||v.map!==map.id||v.mode!==mode||!Array.isArray(v.towers)||v.towers.length>MAX_TOWERS||!Array.isArray(v.enemies)||v.enemies.length>MAX_ENEMIES||!Number.isInteger(v.tick)||v.tick<0||!Number.isFinite(v.money)||!Number.isFinite(v.lives))throw Error('INVALID_SAVE');s=clone(v);s.effects=[];return s;}
  return {get state(){return s;},map,geometry:g,action,step,canPlace,snapshot,restore};
 }
 function replay(round,batch){if(!batch||!Number.isInteger(batch.ticks)||batch.ticks<0||batch.ticks>900||!Array.isArray(batch.commands)||batch.commands.length>100||(!batch.ticks&&!batch.commands.length))throw Error('INVALID_BATCH');const game=create({map:round.map,mode:round.mode,seed:round.seed,challenge:round.challenge});if(round.snapshot)game.restore(round.snapshot);let index=0,last=-1;
  for(const c of batch.commands){if(!Number.isInteger(c.at)||c.at<last||c.at<0||c.at>batch.ticks)throw Error('INVALID_COMMAND');last=c.at;}
  for(let tick=0;tick<=batch.ticks;tick++){while(index<batch.commands.length&&batch.commands[index].at===tick){if(!game.action(batch.commands[index++].action))throw Error('INVALID_COMMAND');}if(tick<batch.ticks){if(game.state.phase!=='wave')throw Error('INVALID_TICKS');game.step();}}
  return game.snapshot();
 }
 return {VERSION,DT,W,H,MAPS,TOWERS,ENEMIES,MODES,PATTERNS,MAX_ENEMIES,MAX_TOWERS,create,stats,upgradeCost,wavePlan,challenge,geometry,point,replay,hash};
});
