/* Bubble Pop's deterministic rules. Rendering and sound cannot change a turn. */
(function(root){
 'use strict';
 const COLS=7,ROWS=8,COLORS=4;
 const LEVELS=[
  {name:'Mint condition',moves:20,color:3,collect:18,ice:0,stars:0},
  {name:'Break the ice',moves:20,color:1,collect:0,ice:12,stars:0},
  {name:'Star delivery',moves:22,color:2,collect:0,ice:0,stars:3},
  {name:'Blue ice',moves:22,color:1,collect:24,ice:14,stars:0},
  {name:'Frozen stars',moves:24,color:0,collect:0,ice:16,stars:4},
  {name:'Supernova',moves:25,color:0,collect:26,ice:14,stars:4}
 ];
 function neighbors(i){const x=i%COLS,y=Math.floor(i/COLS);return [x>0?i-1:-1,x<COLS-1?i+1:-1,y>0?i-COLS:-1,y<ROWS-1?i+COLS:-1].filter(n=>n>=0);}
 function create(random=Math.random,initialLevel=0){
  let board=[],ice=[],score=0,levelScore=0,moves=0,combo=0,nextId=1,level=0,collected=0,delivered=0,status='playing';
  const cell=()=>({color:Math.max(0,Math.min(COLORS-1,Math.floor(random()*COLORS))),power:null,star:false,id:nextId++});
  const rules=()=>LEVELS[level];
  function group(i){
   if(!board[i]||board[i].star||board[i].power)return [];
   const color=board[i].color,seen=new Set([i]),queue=[i];
   while(queue.length)for(const n of neighbors(queue.pop()))if(!seen.has(n)&&!board[n].star&&!board[n].power&&board[n].color===color){seen.add(n);queue.push(n);}
   return [...seen];
  }
  function playable(){return board.some((c,i)=>c.power||(!c.star&&neighbors(i).some(j=>!board[j].star&&!board[j].power&&board[j].color===c.color)));}
  function ensure(){
   if(playable())return false;
   for(let i=0;i<board.length;i++)if(!board[i].star)for(const j of neighbors(i))if(!board[j].star){board[j].color=board[i].color;return true;}
   return false;
  }
  function state(){return {board:board.map(c=>({...c})),ice:[...ice],score,levelScore,moves,combo,level,levelCount:LEVELS.length,name:rules().name,status,done:status!=='playing',goals:{color:rules().color,collect:rules().collect,collected,ice:rules().ice,iceLeft:ice.filter(Boolean).length,stars:rules().stars,delivered}};}
  function reset(target=level,keepScore=false){
   level=Math.max(0,Math.min(LEVELS.length-1,Math.floor(Number(target)||0)));
   if(!keepScore)score=0;
   levelScore=0;combo=0;collected=0;delivered=0;status='playing';moves=rules().moves;
   board=Array.from({length:COLS*ROWS},cell);ice=Array(COLS*ROWS).fill(false);
   // Ice stays on its tile; popping a bubble there breaks it in one hit.
   const pockets=[16,18,23,25,30,32,37,39,44,46,51,53,17,24,31,38];
   pockets.slice(0,rules().ice).forEach(i=>{ice[i]=true;});
   const starColumns=rules().stars===4?[0,2,4,6]:[1,3,5];
   starColumns.slice(0,rules().stars).forEach((x,n)=>{const i=(n%2+1)*COLS+x;board[i]={...board[i],star:true,color:-1};});
   if(level===2)board[52]={...board[52],color:-1,power:'vertical'};
   if(level>=4){board[51]={...board[51],color:-1,power:'bomb'};board[52]={...board[52],color:-1,power:'horizontal'};}
   ensure();return state();
  }
  function restart(){score-=levelScore;return reset(level,true);}
  function next(){if(status!=='won'||level===LEVELS.length-1)return false;return reset(level+1,true);}
  function pop(i){
   if(status!=='playing'||!Number.isInteger(i)||!board[i]||board[i].star)return {valid:false};
   const old=board.map(c=>({...c})),oldIce=[...ice],initial=board[i].power?[i]:group(i);
   if(initial.length<2&&!board[i].power)return {valid:false};
   const cleared=new Set(),activated=new Set(),blasts=[],queue=[],starDrops=[];
   let powerCombo=null,createdPower=null;
   function add(n){if(n>=0&&n<board.length&&!board[n].star&&!cleared.has(n)){cleared.add(n);if(board[n].power)queue.push(n);}}
   function area(n,r){const x=n%COLS,y=Math.floor(n/COLS);for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(x+dx>=0&&x+dx<COLS&&y+dy>=0&&y+dy<ROWS)add((y+dy)*COLS+x+dx);}
   function cross(n,width){const x=n%COLS,y=Math.floor(n/COLS);for(let k=0;k<board.length;k++)if(Math.abs(k%COLS-x)<=width||Math.abs(Math.floor(k/COLS)-y)<=width)add(k);}
   if(board[i].power){
    const partner=neighbors(i).find(n=>board[n].power);
    if(partner!==undefined){
     const a=board[i].power,b=board[partner].power;
     powerCombo=a==='bomb'&&b==='bomb'?'double-bomb':a!=='bomb'&&b!=='bomb'?'double-rocket':'rocket-bomb';
     activated.add(i);activated.add(partner);add(i);add(partner);
     if(powerCombo==='double-bomb'){area(i,2);area(partner,2);}else {cross(i,powerCombo==='rocket-bomb'?1:0);if(powerCombo==='double-rocket')cross(partner,0);}
     blasts.push({index:i,type:powerCombo});
    }else add(i);
   }else{
    initial.forEach(add);
    if(initial.length>=5){createdPower=initial.length>=7?'bomb':(i%2?'vertical':'horizontal');cleared.delete(i);}
   }
   while(queue.length){
    const n=queue.shift();if(activated.has(n))continue;activated.add(n);
    const power=board[n].power;blasts.push({index:n,type:power});
    if(power==='bomb')area(n,1);
    else for(let k=0;k<board.length;k++)if(power==='horizontal'?Math.floor(k/COLS)===Math.floor(n/COLS):k%COLS===n%COLS)add(k);
   }
   let iceBroken=0;
   for(const n of new Set([...cleared,...(createdPower?[i]:[])])){
    if(ice[n]){ice[n]=false;iceBroken++;}
    if(old[n].color===rules().color)collected++;
   }
   if(createdPower)board[i]={...board[i],color:-1,power:createdPower};
   const falls=[];
   for(let x=0;x<COLS;x++){
    const survivors=[];
    for(let y=ROWS-1;y>=0;y--){const n=y*COLS+x;if(!cleared.has(n))survivors.push({cell:board[n],from:y});}
    while(survivors[0]?.cell.star){const star=survivors.shift();delivered++;starDrops.push({index:star.from*COLS+x,id:star.cell.id});}
    for(let y=ROWS-1;y>=0;y--){const k=ROWS-1-y,item=survivors[k]||{cell:cell(),from:-(k-survivors.length+1)};board[y*COLS+x]=item.cell;falls.push({id:item.cell.id,from:item.from,to:y,column:x});}
   }
   const count=cleared.size;combo=count>=5?combo+1:0;const multiplier=Math.min(4,1+Math.floor(combo/2));
   const points=count*count*10*multiplier+iceBroken*50+starDrops.length*500+(powerCombo?500:0);
   score+=points;levelScore+=points;moves--;
   if(collected>=rules().collect&&!ice.some(Boolean)&&delivered>=rules().stars)status='won';else if(moves===0)status='lost';
   const rearranged=ensure();
   return {valid:true,count,points,multiplier,createdPower,powerCombo,detonated:activated.size,blasts,iceBroken,starDrops,cleared:[...cleared],old,oldIce,falls,rearranged,...state()};
  }
  reset(initialLevel);return {state,reset,restart,next,pop,group};
 }
 const api={create,COLS,ROWS,COLORS,LEVELS,neighbors};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.BubblePopEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
