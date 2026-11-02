(function(root){
 'use strict';
 const SIZE=6,COUNTS=[6,7,8,9,9,10,10],LIMITS=[16,14,12,10,9,8,7];
 const districts=['Harbor Start','Market Mile','Garden Junction','Skyline Square','Sunset Avenue','Midnight Crossing','City Center'];
 const colors=['#69d4ef','#8ce4ba','#b5b5ff','#ffd18d','#ffa6b9','#99c1ff','#ffe193'];
 function cells(c){return Array.from({length:c.len},(_,n)=>[c.x+(c.h?n:0),c.y+(c.h?0:n)]);}
 function overlap(a,b){const set=new Set(cells(a).map(p=>p.join(',')));return cells(b).some(p=>set.has(p.join(',')));}
 function canExit(list,c){
  const blocked=(x,y)=>list.some(o=>o!==c&&cells(o).some(p=>p[0]===x&&p[1]===y));
  let x=c.x+(c.h&&c.dir>0?c.len:0),y=c.y+(!c.h&&c.dir>0?c.len:0);
  if(c.dir<0){x-=c.h?1:0;y-=c.h?0:1;}
  while(x>=0&&x<SIZE&&y>=0&&y<SIZE){if(blocked(x,y))return false;x+=c.h?c.dir:0;y+=c.h?0:c.dir;}
  return true;
 }
 // Removing an exit can only open space. Greedy removal is a complete solver
 // for this rule set; no exponential search is needed on the player's phone.
 function solution(list){const remaining=[...list],out=[];while(remaining.length){const i=remaining.findIndex(c=>canExit(remaining,c));if(i<0)return null;out.push(remaining[i].id);remaining.splice(i,1);}return out;}
 const base=[{x:3,y:3,len:3,h:false,dir:-1},{x:4,y:5,len:2,h:true,dir:-1},{x:0,y:1,len:2,h:false,dir:1},{x:0,y:4,len:2,h:true,dir:1},{x:2,y:2,len:2,h:true,dir:1},{x:5,y:0,len:3,h:false,dir:-1},{x:5,y:3,len:2,h:false,dir:-1},{x:1,y:0,len:3,h:true,dir:1},{x:4,y:3,len:2,h:false,dir:1},{x:0,y:3,len:3,h:true,dir:1}];
 function transform(board,turns,mirror){return board.map(c=>{
  let points=cells(c),dx=c.h?c.dir:0,dy=c.h?0:c.dir;
  if(mirror){points=points.map(([x,y])=>[5-x,y]);dx=-dx;}
  for(let i=0;i<turns;i++){points=points.map(([x,y])=>[5-y,x]);[dx,dy]=[-dy,dx];}
  return {...c,x:Math.min(...points.map(p=>p[0])),y:Math.min(...points.map(p=>p[1])),h:dx!==0,dir:dx||dy};
 });}
 function signature(board){return board.map(c=>[c.x,c.y,c.len,+c.h,c.dir].join(':')).sort().join('|');}
 function generate(level,random=Math.random,recent=[]){
  const n=COUNTS[Math.max(0,Math.min(6,level-1))];
  const rand=()=>{const v=Number(random());return Number.isFinite(v)?Math.max(0,Math.min(1-Number.EPSILON,v)):0;};
  for(let attempt=0;attempt<160;attempt++){
   const board=[];
   for(let id=0;id<n;id++){
    for(let tries=0;tries<60;tries++){
     const h=rand()<.5,len=rand()<(level>=4?.46:level>=2?.30:.18)?3:2;
     const c={id,x:Math.floor(rand()*(SIZE-(h?len:1)+1)),y:Math.floor(rand()*(SIZE-(h?1:len)+1)),h,len,dir:rand()<.5?-1:1};
     if(board.every(o=>!overlap(c,o))){board.push(c);break;}
    }
    if(board.length!==id+1)break;
   }
   if(board.length!==n)continue;
   const free=board.filter(c=>canExit(board,c)).length;
   if(free<1||free>2||!solution(board)||recent.includes(signature(board)))continue;
   return board;
  }
  // Bounded fallback: retain the same car count and 1–2 initial exits even
  // with an exhausted/degenerate random source. Symmetries vary the layout.
  for(let mask=1;mask<1024;mask++){
   const board=base.filter((_,i)=>mask&(1<<i));if(board.length!==n)continue;
   const free=board.filter(c=>canExit(board,c)).length;if(free<1||free>2||!solution(board))continue;
   for(let variant=0;variant<8;variant++){
    const b=transform(board,(variant+level)%4,variant>=4).map((c,id)=>({...c,id}));
    if(!recent.includes(signature(b)))return b;
   }
  }
  return transform(base.slice(0,n),level%4,false).map((c,id)=>({...c,id}));
 }
 function create(random=Math.random){
  const state={cars:[],level:1,cleared:0,strikes:0,phase:'ready',remaining:16,elapsed:0,time:0,phaseLeft:0,pending:null,roads:0,cleanRoads:0,fastClears:0,streak:0,bestStreak:0,bestRoadTime:null,boardStrikes:0,reason:'',events:[]};
  const s=state,recent=[];
  function event(type,extra={}){s.events.push({type,...extra});}
  function load(){s.cars=generate(s.level,random,recent);recent.push(signature(s.cars));s.remaining=LIMITS[s.level-1];s.elapsed=0;s.boardStrikes=s.strikes;s.phase='play';s.pending=null;event('road');}
  function end(reason){s.phase='over';s.reason=reason;s.pending=null;event('over',{reason});}
  function takeEvents(){return s.events.splice(0);}
  function tap(id){
   if(s.phase!=='play'||s.remaining<=0)return false;
   const car=s.cars.find(c=>c.id===id);if(!car)return false;
   if(!canExit(s.cars,car)){
    s.strikes++;s.streak=0;event('blocked',{id});
    if(s.strikes>=3)end('crashes');else{s.phase='blocked';s.phaseLeft=.30;}
    return false;
   }
   s.pending=id;s.phase='exit';s.phaseLeft=.18;event('exit',{id});return true;
  }
  function settle(){
   const id=s.pending;s.cars=s.cars.filter(c=>c.id!==id);s.pending=null;s.cleared++;s.streak++;s.bestStreak=Math.max(s.streak,s.bestStreak);event('score',{id});
   if(!s.cars.length){
    s.roads++;const clean=s.strikes===s.boardStrikes,quick=s.elapsed<=Math.max(6,LIMITS[s.level-1]*.58);
    if(clean)s.cleanRoads++;if(quick)s.fastClears++;
    s.bestRoadTime=s.bestRoadTime===null?s.elapsed:Math.min(s.bestRoadTime,s.elapsed);
    event('clear',{level:s.level,clean,quick,seconds:s.elapsed});
    if(s.level===7)end('complete');else{s.phase='transition';s.phaseLeft=.75;}
   }else if(s.remaining<=0)end('timeout');else s.phase='play';
  }
  function advance(dt){
   dt=Number(dt);if(!Number.isFinite(dt)||dt<=0||s.phase==='over'||s.phase==='ready')return takeEvents();
   while(dt>1e-9&&s.phase!=='over'){
    const timed=s.phase!=='transition',waiting=s.phase!=='play';
    const until=waiting?s.phaseLeft:s.remaining;
    // A committed exit may finish beyond zero; uncommitted taps may not.
    const step=Math.min(dt,until);s.time+=step;dt-=step;
    if(timed){s.elapsed+=step;s.remaining=Math.max(0,s.remaining-step);}
    if(waiting)s.phaseLeft-=step;
    if(s.phase==='play'&&s.remaining<=1e-9)end('timeout');
    else if(waiting&&s.phaseLeft<=1e-9){if(s.phase==='exit')settle();else if(s.phase==='transition'){s.level++;load();}else if(s.remaining<=0)end('timeout');else s.phase='play';}
   }
   return takeEvents();
  }
  return {state,start(){if(s.phase==='ready')load();return takeEvents();},tap,advance,takeEvents};
 }
 const api={SIZE,COUNTS,LIMITS,districts,colors,cells,overlap,canExit,solution,signature,generate,create};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.TrafficEscapeEngine=api;
})(typeof window!=='undefined'?window:globalThis);
