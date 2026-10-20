/* Small deterministic board model; visual effects never change scoring. */
(function(root){
 const COLS=7,ROWS=8,COLORS=4;
 function create(random=Math.random){let board=[],score=0,moves=20,combo=0,nextId=1;
  const cell=()=>({color:Math.min(COLORS-1,Math.floor(random()*COLORS)),bomb:false,id:nextId++});
  function neighbors(i){const x=i%COLS,y=Math.floor(i/COLS);return [x>0?i-1:-1,x<COLS-1?i+1:-1,y>0?i-COLS:-1,y<ROWS-1?i+COLS:-1].filter(n=>n>=0);}
  function group(i){if(!board[i])return [];const color=board[i].color,seen=new Set([i]),queue=[i];while(queue.length){for(const n of neighbors(queue.pop()))if(!seen.has(n)&&board[n].color===color&&!board[n].bomb){seen.add(n);queue.push(n);}}return [...seen];}
  function playable(){return board.some((c,i)=>c.bomb||neighbors(i).some(j=>board[j].color===c.color));}
  function ensure(){if(playable())return false;board[1].color=board[0].color;return true;}
  function reset(){board=Array.from({length:COLS*ROWS},cell);score=0;moves=20;combo=0;ensure();return state();}
  function state(){return {board:board.map(c=>({...c})),score,moves,combo,done:moves===0};}
  function pop(i){if(!Number.isInteger(i)||!board[i]||moves<=0)return {valid:false};const initial=board[i].bomb?[i]:group(i);if(initial.length<2&&!board[i].bomb)return {valid:false};
   const cleared=new Set(initial),queue=[...initial],detonated=new Set();
   while(queue.length){const n=queue.pop();if(!board[n].bomb||detonated.has(n))continue;detonated.add(n);const x=n%COLS,y=Math.floor(n/COLS);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=COLS||ny<0||ny>=ROWS)continue;const j=ny*COLS+nx;if(!cleared.has(j)){cleared.add(j);queue.push(j);}}}
   const count=cleared.size,makesBomb=initial.length>=6&&!board[i].bomb;combo=count>=6?combo+1:0;const multiplier=Math.min(4,1+Math.floor(combo/2)),points=count*count*10*multiplier+(count>=10?500:0);score+=points;moves--;
   const old=state().board;if(makesBomb){board[i]={...board[i],bomb:true};cleared.delete(i);}
   for(let x=0;x<COLS;x++){const survivors=[];for(let y=ROWS-1;y>=0;y--){const n=y*COLS+x;if(!cleared.has(n))survivors.push(board[n]);}for(let y=ROWS-1;y>=0;y--)board[y*COLS+x]=survivors[ROWS-1-y]||cell();}
   const rearranged=ensure();return {valid:true,count,points,multiplier,makesBomb,detonated:detonated.size,cleared:[...cleared],old,rearranged,...state()};
  }
  reset();return {state,reset,pop,group};
 }
 const api={create,COLS,ROWS,COLORS};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.BubblePopEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
