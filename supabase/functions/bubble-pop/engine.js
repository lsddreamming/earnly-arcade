/* Original Earnly match-three rules. Random draws never depend on spending or losses. */
(function(root){
 'use strict';
 const COLS=7,ROWS=8,COLORS=5,CAMPAIGN_LEVELS=1000;
 const LEVELS=[
  {name:'First splash',moves:22,color:3,collect:18,ice:0,stars:0},
  {name:'Crystal shores',moves:24,color:1,collect:0,ice:10,stars:0},
  {name:'Stardrop lagoon',moves:26,color:2,collect:0,ice:0,stars:2},
  {name:'Blue bloom',moves:26,color:1,collect:22,ice:8,stars:0},
  {name:'Frozen orbit',moves:28,color:0,collect:0,ice:10,stars:3},
  {name:'Prism party',moves:30,color:4,collect:24,ice:10,stars:2}
 ];
 const INTRO_LEVELS=[
  {name:'First splash',moves:22,color:3,collect:18,ice:0,stars:0},
  {name:'Blue bloom',moves:24,color:1,collect:21,ice:0,stars:0},
  {name:'Golden glow',moves:26,color:2,collect:24,ice:0,stars:0},
  {name:'Crystal shores',moves:26,color:1,collect:0,ice:8,stars:0},
  {name:'Stardrop lagoon',moves:28,color:0,collect:0,ice:0,stars:2},
  {name:'Prism party',moves:30,color:4,collect:24,ice:10,stars:2}
 ];
 const THEMES=['Coral Coast','Crystal Cavern','Starlight Station','Mint Garden'];
 const normalizeLevel=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(999,Math.floor(Number(v)))):0;
 function levelRules(v){const l=normalizeLevel(v);if(l<6)return {...INTRO_LEVELS[l]};const chapter=Math.floor(l/10),step=l%10,tier=Math.min(3,Math.floor(l/50)),b=LEVELS[step%6];return {...b,name:THEMES[chapter%4]+' '+(chapter+1)+'–'+(step+1),moves:b.moves+2+tier,color:(b.color+chapter)%COLORS,collect:b.collect?b.collect+tier*2:0,ice:b.ice?b.ice+tier*2:0};}
 function neighbors(i){const x=i%COLS,y=Math.floor(i/COLS);return [x?i-1:-1,x<COLS-1?i+1:-1,y?i-COLS:-1,y<ROWS-1?i+COLS:-1].filter(n=>n>=0);}
 const matchable=c=>c&&!c.star&&c.power!=='prism'&&c.color>=0;
 function matches(board){
  const runs=[];
  for(let axis=0;axis<2;axis++)for(let line=0;line<(axis?COLS:ROWS);line++){
   let run=[];const flush=()=>{if(run.length>=3)runs.push({indices:run,axis});run=[];};
   for(let p=0;p<(axis?ROWS:COLS);p++){const i=axis?p*COLS+line:line*COLS+p,c=board[i];if(!matchable(c)){flush();continue;}if(run.length&&board[run[0]].color!==c.color)flush();run.push(i);}flush();
  }return runs;
 }
 function legalMoves(board){const out=[];for(let i=0;i<board.length;i++)for(const j of neighbors(i)){if(j<i||board[i].star||board[j].star)continue;if(board[i].power||board[j].power){out.push([i,j]);continue;}[board[i],board[j]]=[board[j],board[i]];const ok=matches(board).some(r=>r.indices.includes(i)||r.indices.includes(j));[board[i],board[j]]=[board[j],board[i]];if(ok)out.push([i,j]);}return out;}
 function create(random=Math.random,initialLevel=0){
  let board=[],ice=[],score=0,levelScore=0,moves=0,combo=0,nextId=1,level=0,collected=0,delivered=0,status='playing',assisted=false;
  const drawColor=()=>Math.max(0,Math.min(COLORS-1,Math.floor((Number(random())||0)*COLORS)));
  const cell=()=>({color:drawColor(),power:null,star:false,id:nextId++});
  const rules=()=>levelRules(level);
  function state(){const r=rules(),progress=[];if(r.collect)progress.push(Math.min(1,collected/r.collect));if(r.ice)progress.push(1-ice.filter(Boolean).length/r.ice);if(r.stars)progress.push(delivered/r.stars);return {board:board.map(c=>({...c})),ice:[...ice],score,levelScore,moves,combo,level,levelCount:1000,name:r.name,status,done:status!=='playing',assisted,progress:progress.reduce((a,b)=>a+b,0)/progress.length,goals:{color:r.color,collect:r.collect,collected,ice:r.ice,iceLeft:ice.filter(Boolean).length,stars:r.stars,delivered}};}
  function stabilize(){ // Bounded even for a broken/constant RNG; never leaves free opening matches.
   for(let i=0;i<board.length;i++){if(!matchable(board[i]))continue;for(let k=0;k<COLORS;k++){const c=board[i].color,x=i%COLS;if(!(x>=2&&matchable(board[i-1])&&matchable(board[i-2])&&board[i-1].color===c&&board[i-2].color===c)&&!(i>=COLS*2&&matchable(board[i-COLS])&&matchable(board[i-2*COLS])&&board[i-COLS].color===c&&board[i-2*COLS].color===c))break;board[i].color=(c+1)%COLORS;}}
  }
  function ensure(){if(legalMoves(board).length)return false;
   // A visible rescue power makes a dead board playable without altering goal tiles/stars.
   const i=board.findIndex(c=>!c.star);board[i]={...board[i],power:'prism',color:-1};return true;
  }
  function reset(target=level,keepScore=false){level=normalizeLevel(target);if(!keepScore)score=0;levelScore=0;combo=0;collected=0;delivered=0;status='playing';assisted=false;moves=rules().moves;
   board=Array.from({length:56},cell);ice=Array(56).fill(false);
   Array.from({length:56},(_,i)=>(i*17+level*11)%56).slice(0,rules().ice).forEach(i=>ice[i]=true);
   [1,3,5].slice(0,rules().stars).forEach((x,n)=>{const i=(1+n%2)*COLS+(x+level)%COLS;board[i]={...board[i],star:true,color:-1};});
   if(level>=4){board[49].power='horizontal';board[50].power='bomb';}
   stabilize();ensure();return state();
  }
  function restart(){score-=levelScore;return reset(level,true);}
  function next(){if(status!=='won'||level===999)return false;return reset(level+1,true);}
  function assist(){if(status!=='playing'||assisted)return false;assisted=true;moves+=3;return state();}
  function swap(a,b){
   if(status!=='playing'||!Number.isInteger(a)||!Number.isInteger(b)||!board[a]||!neighbors(a).includes(b)||board[a].star||board[b].star)return {valid:false};
   const original=board.map(c=>({...c}));[board[a],board[b]]=[board[b],board[a]];
   let runs=matches(board);const powers=[a,b].filter(i=>board[i].power);
   if(!powers.length&&!runs.some(r=>r.indices.includes(a)||r.indices.includes(b))){board=original;return {valid:false};}
   const waves=[];let total=0,points=0,createdPower=null,powerCombo=null,rearranged=false;
   for(let wave=0;wave<32;wave++){
    const old=board.map(c=>({...c})),oldIce=[...ice],cleared=new Set(),activated=new Set(),blasts=[],queue=[],starDrops=[],reserved=new Map();
    const add=i=>{if(i>=0&&i<56&&!board[i].star&&!cleared.has(i)){cleared.add(i);if(board[i].power)queue.push(i);}};
    const area=(i,r)=>{for(let n=0;n<56;n++)if(Math.abs(n%7-i%7)<=r&&Math.abs(Math.floor(n/7)-Math.floor(i/7))<=r)add(n);};
    const cross=(i,r)=>{for(let n=0;n<56;n++)if(Math.abs(n%7-i%7)<=r||Math.abs(Math.floor(n/7)-Math.floor(i/7))<=r)add(n);};
    // Merge intersecting runs before choosing one special piece per match shape.
    const groups=[];for(const run of runs){let joined={indices:new Set(run.indices),runs:[run]};for(let k=groups.length-1;k>=0;k--)if([...joined.indices].some(i=>groups[k].indices.has(i))){for(const i of groups[k].indices)joined.indices.add(i);joined.runs.push(...groups[k].runs);groups.splice(k,1);}groups.push(joined);}
    for(const g of groups){for(const i of g.indices)add(i);const longest=g.runs.reduce((x,y)=>x.indices.length>=y.indices.length?x:y),turn=g.runs.some(r=>r.axis!==longest.axis);const type=longest.indices.length>=5?'prism':turn?'bomb':longest.indices.length===4?(longest.axis?'vertical':'horizontal'):null;
     if(type){const spot=[b,a,...g.indices].find(i=>g.indices.has(i)&&!board[i].power);if(spot!==undefined){reserved.set(spot,type);createdPower=type;}}
    }
    if(wave===0&&powers.length){
     if(powers.length===2){const [p,q]=powers,one=board[p].power,two=board[q].power;activated.add(p);activated.add(q);add(p);add(q);
      if(one==='prism'||two==='prism'){powerCombo=one==='prism'&&two==='prism'?'double-prism':'prism-power';if(powerCombo==='double-prism'){for(let i=0;i<56;i++)add(i);}else{const other=one==='prism'?q:p;for(let i=0;i<56;i++)if(board[i].color===board[other].color){if(!board[i].power)board[i].power=board[other].power;add(i);}}}
      else if(one==='bomb'&&two==='bomb'){powerCombo='double-bomb';area(p,2);area(q,2);}else {powerCombo=one==='bomb'||two==='bomb'?'rocket-bomb':'double-rocket';cross(p,powerCombo==='rocket-bomb'?1:0);cross(q,0);}blasts.push({index:p,type:powerCombo});
     }else {const p=powers[0];if(board[p].power==='prism'){activated.add(p);add(p);const color=board[p===a?b:a].color;for(let i=0;i<56;i++)if(board[i].color===color)add(i);blasts.push({index:p,type:'prism'});}else add(p);}
    }
    while(queue.length){const i=queue.shift();if(activated.has(i))continue;activated.add(i);const p=board[i].power;blasts.push({index:i,type:p});if(p==='bomb')area(i,1);else if(p==='prism'){const color=rules().color;for(let n=0;n<56;n++)if(board[n].color===color)add(n);}else for(let n=0;n<56;n++)if(p==='horizontal'?Math.floor(n/7)===Math.floor(i/7):n%7===i%7)add(n);}
    let iceBroken=0;for(const i of cleared){if(ice[i]){ice[i]=false;iceBroken++;}if(old[i].color===rules().color)collected++;}
    for(const [i,type] of reserved){cleared.delete(i);board[i]={...board[i],power:type,color:type==='prism'?-1:board[i].color};}
    if(!cleared.size)break;
    const falls=[];for(let x=0;x<7;x++){const survivors=[];for(let y=7;y>=0;y--)if(!cleared.has(y*7+x))survivors.push({cell:board[y*7+x],from:y});while(survivors[0]?.cell.star){const item=survivors.shift();delivered++;starDrops.push({index:item.from*7+x,id:item.cell.id});}
     for(let y=7;y>=0;y--){const k=7-y,item=survivors[k]||{cell:cell(),from:-(k-survivors.length+1)};board[y*7+x]=item.cell;falls.push({id:item.cell.id,from:item.from,to:y,column:x});}}
    const gain=cleared.size*60*Math.min(4,wave+1)+iceBroken*100+starDrops.length*600+(wave===0&&powerCombo?400:0);score+=gain;levelScore+=gain;points+=gain;total+=cleared.size;
    waves.push({old,oldIce,cleared:[...cleared],blasts,starDrops,falls:falls.sort((x,y)=>(x.to*7+x.column)-(y.to*7+y.column)),board:board.map(c=>({...c})),ice:[...ice],points:gain});
    runs=matches(board);if(!runs.length)break;
    if(wave===31){stabilize();rearranged=true;}
   }
   moves--;combo=waves.length;
   if(collected>=rules().collect&&!ice.some(Boolean)&&delivered>=rules().stars)status='won';else if(moves===0)status='lost';
   if(status==='playing')rearranged=ensure()||rearranged;
   return {valid:true,waves,count:total,points,createdPower,powerCombo,rearranged,...state()};
  }
  reset(initialLevel);return {state,reset,restart,next,swap,assist,legalMoves:()=>legalMoves(board)};
 }
 const seededRandom=seed=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const api={seededRandom,create,COLS,ROWS,COLORS,LEVELS,THEMES,neighbors,CAMPAIGN_LEVELS,levelRules,normalizeLevel,matches,legalMoves};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.BubblePopEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
