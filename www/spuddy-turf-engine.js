(function(root){
'use strict';
const SIZE=40,DIRS=[[1,0],[0,1],[-1,0],[0,-1]],N=SIZE*SIZE;
const index=(x,y)=>y*SIZE+x,inside=(x,y)=>x>=0&&y>=0&&x<SIZE&&y<SIZE;
function create({seed=Date.now(),mode='classic'}={}){
 const s={mode,grid:new Int8Array(N),trails:new Int8Array(N),actors:[],time:0,clock:0,ended:false,reason:'',events:[],captures:0,cuts:0,peak:0,seed:seed>>>0,limit:mode==='practice'?180:120};
 const starts=[[8,20,0,'You'],[30,8,1,'Mochi'],[31,31,2,'Blitz'],[8,7,0,'Zippy']];
 starts.slice(0,mode==='practice'?1:4).forEach(([x,y,dir,name],i)=>{const a={id:i+1,x,y,px:x,py:y,dir,next:dir,alive:true,path:[],plan:[],name,respawn:0};s.actors.push(a);for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+2;xx++)s.grid[index(xx,yy)]=a.id;});
 s.peak=area(s,1);return s;
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function area(s,id){let n=0;for(const v of s.grid)if(v===id)n++;return n/N*100;}
function turn(s,dir){const a=s.actors[0];if(!s.ended&&Number.isInteger(dir)&&dir>=0&&dir<4&&(dir+2)%4!==a.dir)a.next=dir;}
function eliminate(s,a,why,killer){if(!a.alive)return;a.alive=false;for(let i=0;i<N;i++){if(s.grid[i]===a.id)s.grid[i]=0;if(s.trails[i]===a.id)s.trails[i]=0;}a.path=[];s.events.push({type:'cut',id:a.id,x:a.x,y:a.y});if(killer===1&&a.id!==1)s.cuts++;if(a.id===1){s.ended=true;s.reason=why;}else a.respawn=s.time+4;}
function close(s,a){
 const before=area(s,a.id);for(const p of a.path){s.grid[p]=a.id;s.trails[p]=0;}a.path=[];
 // Boundary flood fill: only this actor's territory blocks the exterior.
 const outside=new Uint8Array(N),queue=new Int32Array(N);let head=0,tail=0;
 function add(p){if(!outside[p]&&s.grid[p]!==a.id){outside[p]=1;queue[tail++]=p;}}
 for(let i=0;i<SIZE;i++){add(i);add((SIZE-1)*SIZE+i);add(i*SIZE);add(i*SIZE+SIZE-1);}
 while(head<tail){const p=queue[head++],x=p%SIZE,y=Math.floor(p/SIZE);if(x)add(p-1);if(x<SIZE-1)add(p+1);if(y)add(p-SIZE);if(y<SIZE-1)add(p+SIZE);}
 for(let p=0;p<N;p++)if(!outside[p])s.grid[p]=a.id;
 const gain=area(s,a.id)-before;s.events.push({type:'claim',id:a.id,gain,x:a.x,y:a.y});if(a.id===1){s.captures++;s.peak=Math.max(s.peak,area(s,1));}
 // A trail swallowed by another claim is severed, never left invisible beneath land.
 for(const other of s.actors)if(other.alive&&other.id!==a.id&&(other.path.some(p=>s.grid[p]===a.id)||!s.grid.includes(other.id)))eliminate(s,other,'A rival claimed your trail.',a.id);
}
function routeHome(s,a){
 const start=index(a.x,a.y),prev=new Int32Array(N).fill(-1),queue=[start];prev[start]=start;let found=-1;
 for(let h=0;h<queue.length&&found<0;h++){const p=queue[h],x=p%SIZE,y=Math.floor(p/SIZE);for(let d=0;d<4;d++){if(p===start&&(d+2)%4===a.dir)continue;const nx=x+DIRS[d][0],ny=y+DIRS[d][1];if(!inside(nx,ny))continue;const q=index(nx,ny);if(prev[q]>=0||s.trails[q]===a.id)continue;prev[q]=p;if(s.grid[q]===a.id){found=q;break;}queue.push(q);}}
 if(found<0)return [];const path=[];for(let p=found;p!==start;p=prev[p]){const diff=p-prev[p];path.push(diff===1?0:diff===SIZE?1:diff===-1?2:3);}return path.reverse();
}
function bot(s,a){
 if(!a.plan.length){
  if(a.path.length){a.plan=routeHome(s,a);}
  else {const candidates=[0,1,2,3].filter(d=>(d+2)%4!==a.dir);const d=candidates[Math.floor(random(s)*candidates.length)],side=random(s)<.5?1:3,len=4+Math.floor(random(s)*5),wide=4+Math.floor(random(s)*5);a.plan=[...Array(len).fill(d),...Array(wide).fill((d+side)%4),...Array(len).fill((d+2)%4),...Array(wide).fill((d+side+2)%4)];}
 }
 // Return earlier if a nearby rival is threatening the exposed tail.
 const p=s.actors[0];if(a.path.length>10&&p.alive&&Math.abs(p.x-a.x)+Math.abs(p.y-a.y)<7)a.plan=routeHome(s,a);
 // Opportunistic cuts: bots can turn toward a nearby exposed player trail.
 if(p.alive&&p.path.length&&a.path.length<10&&random(s)<.3){const nearest=p.path.map(q=>({x:q%SIZE,y:Math.floor(q/SIZE)})).sort((u,v)=>(Math.abs(u.x-a.x)+Math.abs(u.y-a.y))-(Math.abs(v.x-a.x)+Math.abs(v.y-a.y)))[0];if(Math.abs(nearest.x-a.x)+Math.abs(nearest.y-a.y)<6){const hunt=[0,1,2,3].filter(d=>(d+2)%4!==a.dir).sort((u,v)=>Math.abs(nearest.x-a.x-DIRS[u][0])+Math.abs(nearest.y-a.y-DIRS[u][1])-Math.abs(nearest.x-a.x-DIRS[v][0])-Math.abs(nearest.y-a.y-DIRS[v][1]));a.plan=[hunt[0]];}}
 let d=a.plan.shift()??a.dir;
 const valid=k=>{const x=a.x+DIRS[k][0],y=a.y+DIRS[k][1];return (k+2)%4!==a.dir&&inside(x,y)&&s.trails[index(x,y)]!==a.id;};
 if(!valid(d)){a.plan=[];const home=routeHome(s,a);d=home.length?home[0]:[a.dir,(a.dir+1)%4,(a.dir+3)%4].find(valid);}
 return d??a.dir;
}
function respawn(s,a){if(s.time<a.respawn)return;const options=[];for(let y=3;y<SIZE-3;y+=6)for(let x=3;x<SIZE-3;x+=6){let clear=true;for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+2;xx++)if(s.grid[index(xx,yy)]||s.trails[index(xx,yy)])clear=false;if(clear&&s.actors.every(o=>!o.alive||Math.abs(o.x-x)+Math.abs(o.y-y)>9))options.push([x,y]);}if(!options.length){a.respawn=s.time+3;return;}const [x,y]=options[Math.floor(random(s)*options.length)];Object.assign(a,{x,y,px:x,py:y,dir:0,next:0,alive:true,plan:[],path:[]});for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+2;xx++)s.grid[index(xx,yy)]=a.id;}
function step(s){
 const movers=s.actors.filter(a=>a.alive).map(a=>{const dir=a.id===1?a.next:bot(s,a);return {a,dir,x:a.x+DIRS[dir][0],y:a.y+DIRS[dir][1]};});
 for(const m of movers){const {a,x,y}=m;if(!inside(x,y))eliminate(s,a,'You reached the edge. Turn before the border.');}
 // Head-on and swap collisions are symmetric; neither actor wins by update order.
 for(let i=0;i<movers.length;i++)for(let j=i+1;j<movers.length;j++){const m=movers[i],n=movers[j];if(m.a.alive&&n.a.alive&&((m.x===n.x&&m.y===n.y)||(m.x===n.a.x&&m.y===n.a.y&&n.x===m.a.x&&n.y===m.a.y))){eliminate(s,m.a,'Head-on collision. Give rivals some space.');eliminate(s,n.a,'Head-on collision.');}}
 for(const {a,x,y,dir}of movers){if(!a.alive)continue;const q=index(x,y),tail=s.trails[q];if(tail===a.id){eliminate(s,a,'You crossed your own trail. Close a loop first.');continue;}if(tail){const victim=s.actors[tail-1];eliminate(s,victim,'A rival cut your exposed trail.',a.id);}a.px=a.x;a.py=a.y;a.x=x;a.y=y;a.dir=dir;if(a.id===1)a.next=dir;
  if(s.grid[q]===a.id){if(a.path.length)close(s,a);}else{s.trails[q]=a.id;a.path.push(q);}
 }
 if(s.ended)return;
 s.peak=Math.max(s.peak,area(s,1));
 if(area(s,1)>=35){s.ended=true;s.reason='You claimed 35% of the island!';}
}
function tick(s,dt){if(s.ended||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);s.events=[];s.time=Math.min(s.limit,s.time+dt);s.clock+=dt;const period=s.mode==='practice'?.18:.145;while(s.clock>=period&&!s.ended){s.clock-=period;step(s);}if(s.ended)return;for(const a of s.actors)if(!a.alive&&a.id!==1)respawn(s,a);if(s.time>=s.limit){s.ended=true;s.reason=s.mode==='practice'?'Practice complete. Try a bigger loop next time.':rank(s)[0].id===1?'Time! You own the biggest patch.':'Time! A rival finished with more land.';}}
// Read-only navigation and risk information for the HUD / renderer.
// A guide to the closest owned cell, not autopilot: the player still steers,
// closes loops and must obey the existing no-reverse collision rules.
function trailStatus(s){
 const a=s.actors[0],path=a.path||[],length=path.length;
 const next=a.next??a.dir;
 const edge=(next===0&&a.x>=37)||(next===1&&a.y>=37)||
            (next===2&&a.x<=2)||(next===3&&a.y<=2);
 let home=null,closest=Infinity;
 if(length){
   for(let p=0;p<N;p++)if(s.grid[p]===1){
     const x=p%SIZE,y=Math.floor(p/SIZE),distance=Math.abs(a.x-x)+Math.abs(a.y-y);
     if(distance<closest){closest=distance;home={x,y};}
   }
 }
 let rivalDistance=Infinity;
 if(length){
   for(const rival of s.actors){
     if(rival.id===1||!rival.alive)continue;
     for(const p of path){
       const d=Math.abs(rival.x-p%SIZE)+Math.abs(rival.y-Math.floor(p/SIZE));
       if(d<rivalDistance)rivalDistance=d;
     }
   }
 }
 let direction='';
 if(home){
   const dx=home.x-a.x,dy=home.y-a.y;
   direction=Math.abs(dx)>=Math.abs(dy)?dx>0?'RIGHT':'LEFT':dy>0?'DOWN':'UP';
 }
 return {exposed:length>0,length,edge,home,homeDistance:length?closest:0,
   homeDirection:direction,rivalDistance,
   nearbyRival:Number.isFinite(rivalDistance)&&rivalDistance<=5,
   risk:length===0?'safe':rivalDistance<=5?'danger':'exposed'};
}
function rank(s){return s.actors.map(a=>({id:a.id,name:a.name,area:area(s,a.id),alive:a.alive})).sort((a,b)=>b.area-a.area||a.id-b.id);}
const api={SIZE,DIRS,create,tick,turn,area,rank,step,close,index,routeHome,trailStatus};if(typeof module!=='undefined')module.exports=api;root.SpuddyTurfEngine=api;
})(typeof window!=='undefined'?window:globalThis);
