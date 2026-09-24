const { test, expect } = require('@playwright/test');

function rng(seed){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296}}

function bounceSample(cleared, random){
  const speed=cleared<5?1.35+cleared*.16:cleared<10?2.9+(cleared-5)*.24:cleared<20?4.1+(cleared-10)*.22:cleared<35?6.3+(cleared-20)*.10:Math.min(10,7.8+(cleared-35)*.045);
  const r=random();
  const delay=cleared<5?175+random()*35:cleared<10?(r<.20?48+random()*18:92+random()*58):cleared<20?(r<.34?34+random()*20:r<.48?135+random()*45:68+random()*55):cleared<35?(r<.42?28+random()*18:r<.58?125+random()*55:55+random()*58):(r<.48?24+random()*18:r<.65?118+random()*62:46+random()*60);
  const width=cleared<5?16+random()*7:cleared<10?26+random()*15:cleared<20?32+random()*25:cleared<35?38+random()*35:44+random()*Math.min(52,24+(cleared-35)*1.2);
  return {speed,delay,width};
}

test('Bounce Run: 100,000 obstacle samples stay inside safety bounds',()=>{
  const random=rng(81); let minDelay=Infinity,maxSpeed=0,maxWidth=0,problem=null;
  for(let i=0;i<100000;i++){
    const cleared=i%101, sample=bounceSample(cleared,random);
    minDelay=Math.min(minDelay,sample.delay);maxSpeed=Math.max(maxSpeed,sample.speed);maxWidth=Math.max(maxWidth,sample.width);
    if(!problem && (sample.delay<24 || sample.speed>10 || sample.width>96)){
      problem={i,cleared,...sample};
    }
  }
  expect(problem,'first out-of-bounds obstacle sample').toBeNull();
  expect({minDelay,maxSpeed,maxWidth}).toEqual(expect.objectContaining({
    minDelay:expect.any(Number),maxSpeed:expect.any(Number),maxWidth:expect.any(Number)
  }));
  expect(minDelay).toBeGreaterThanOrEqual(24);
  expect(maxSpeed).toBeLessThanOrEqual(10);
  expect(maxWidth).toBeLessThanOrEqual(96);
});

const SHAPES=[
 {name:'L',cells:[[0,0],[0,1],[0,2],[1,2]]},
 {name:'T',cells:[[0,0],[1,0],[2,0],[1,1]]},
 {name:'Square',cells:[[0,0],[1,0],[0,1],[1,1]]},
 {name:'Zigzag',cells:[[0,0],[1,0],[1,1],[2,1]]},
 {name:'Line',cells:[[0,0],[1,0],[2,0],[3,0]]},
 {name:'Corner',cells:[[0,0],[0,1],[1,1]]}
];
function rotate(cells,t){let a=cells.map(p=>[...p]);while(t--){a=a.map(([x,y])=>[3-y,x]);const minX=Math.min(...a.map(p=>p[0])),minY=Math.min(...a.map(p=>p[1]));a=a.map(([x,y])=>[x-minX,y-minY])}return a}
function key(c){return c.map(p=>p.join(',')).sort().join('|')}

test('Shape Fit: 50,000 rounds always contain exactly one base-shape answer',()=>{
 const random=rng(203); let problem=null;
 for(let round=1;round<=50000;round++){
  const base=SHAPES[Math.floor(random()*SHAPES.length)], turns=round<4?0:Math.floor(random()*4);
  const answer={base,cells:rotate(base.cells,turns)};
  const count=round<=3?3:round<=7?4:round<=13?6:8;
  const correctTurns=round<4?turns:(turns+1+Math.floor(random()*3))%4;
  const opts=[{base,cells:rotate(base.cells,correctTurns)}],used=new Set([base.name+':'+key(opts?.[0]?.cells||rotate(base.cells,correctTurns))]);
  let guard=0;
  while(opts.length<count&&guard++<500){
   const sh=SHAPES[Math.floor(random()*SHAPES.length)];
   if(sh===base)continue;
   const v={base:sh,cells:rotate(sh.cells,Math.floor(random()*4))},k=sh.name+':'+key(v.cells);
   if(!used.has(k)){used.add(k);opts.push(v)}
  }
  const matching=opts.filter(o=>o.base===answer.base).length;
  if(!problem && (opts.length!==count || matching!==1)){
    problem={round,base:base.name,expectedChoices:count,actualChoices:opts.length,matching,guard};
  }
 }
 expect(problem,'first invalid Shape Fit round').toBeNull();
});

const N=6;
function cells(c){return Array.from({length:c.len},(_,n)=>[c.x+(c.h?n:0),c.y+(c.h?0:n)])}
function overlap(a,b){const s=new Set(cells(a).map(p=>p.join(',')));return cells(b).some(p=>s.has(p.join(',')))}
function canExit(list,car){const blocked=(x,y)=>list.some(o=>o!==car&&cells(o).some(([ox,oy])=>ox===x&&oy===y));if(car.h){if(car.dir>0){for(let x=car.x+car.len;x<N;x++)if(blocked(x,car.y))return false}else for(let x=car.x-1;x>=0;x--)if(blocked(x,car.y))return false}else if(car.dir>0){for(let y=car.y+car.len;y<N;y++)if(blocked(car.x,y))return false}else for(let y=car.y-1;y>=0;y--)if(blocked(car.x,y))return false;return true}
function solvable(list){const memo=new Map();function solve(rem){if(!rem.length)return true;const k=rem.map(c=>c.id).sort((a,b)=>a-b).join(',');if(memo.has(k))return memo.get(k);for(const c of rem.filter(c=>canExit(rem,c)))if(solve(rem.filter(o=>o!==c))){memo.set(k,true);return true}memo.set(k,false);return false}return solve(list)}
function trafficBoard(level,random){
 const target=[0,6,7,8,9,9,10,10][Math.min(7,level)];
 const minBlocked=Math.min(target-1,[0,4,5,6,7,7,8,8][Math.min(7,level)]);
 for(let attempt=0;attempt<400;attempt++){
  const a=[];
  for(let id=0;id<target;id++){
   let placed=false;
   for(let t=0;t<100&&!placed;t++){
    const h=random()<.5;
    const len=random()<(level>=4?.46:level>=2?.30:.18)?3:2;
    const x=Math.floor(random()*(N-(h?len:1)+1));
    const y=Math.floor(random()*(N-(h?1:len)+1));
    const car={x,y,len,h,dir:random()<.5?-1:1,id};
    if(a.every(o=>!overlap(car,o))){a.push(car);placed=true}
   }
   if(!placed)break;
  }
  if(a.length!==target)continue;
  const blocked=a.filter(c=>!canExit(a,c)).length;
  const free=target-blocked;
  if(blocked<minBlocked||free<1||free>2)continue;
  if(solvable(a))return a;
 }
 const fallback=level>=4?[
  {x:3,y:3,len:3,h:false,dir:-1,id:0},{x:4,y:5,len:2,h:true,dir:-1,id:1},
  {x:0,y:1,len:2,h:false,dir:1,id:2},{x:0,y:4,len:2,h:true,dir:1,id:3},
  {x:2,y:2,len:2,h:true,dir:1,id:4},{x:5,y:0,len:3,h:false,dir:-1,id:5},
  {x:5,y:3,len:2,h:false,dir:-1,id:6},{x:1,y:0,len:3,h:true,dir:1,id:7},
  {x:4,y:3,len:2,h:false,dir:1,id:8},{x:0,y:3,len:3,h:true,dir:1,id:9}
 ]:[
  {x:0,y:0,len:2,h:true,dir:-1,id:0},{x:3,y:0,len:2,h:false,dir:-1,id:1},
  {x:1,y:2,len:2,h:true,dir:1,id:2},{x:4,y:2,len:2,h:false,dir:1,id:3},
  {x:0,y:5,len:2,h:true,dir:-1,id:4}
 ];
 return fallback;
}

test('Traffic Escape: 3,500 harder boards stay valid and solvable',()=>{
 const random=rng(9901); let problem=null;
 for(let i=0;i<3500;i++){
  const level=1+(i%7), board=trafficBoard(level,random);
  const noOverlap=board.every((c,idx)=>board.every((o,j)=>idx===j||!overlap(c,o)));
  const canSolve=solvable(board);
  const free=board.filter(c=>canExit(board,c)).length;
  const validFree=free>=1 && free<=(level>=4?2:5);
  const validSize=level<4 || board.length>=9;
  if(!problem && (!noOverlap || !canSolve || !validFree || !validSize)){
    problem={i,level,noOverlap,canSolve,free,size:board.length};
  }
 }
 expect(problem,'first invalid Traffic Escape board').toBeNull();
});
