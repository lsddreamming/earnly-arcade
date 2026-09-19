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
  const random=rng(81); let minDelay=Infinity,maxSpeed=0,maxWidth=0;
  for(let i=0;i<100000;i++){
    const cleared=i%101, s=bounceSample(cleared,random);
    minDelay=Math.min(minDelay,s.delay);maxSpeed=Math.max(maxSpeed,s.speed);maxWidth=Math.max(maxWidth,s.width);
    expect(s.delay).toBeGreaterThanOrEqual(24);
    expect(s.speed).toBeLessThanOrEqual(10);
    expect(s.width).toBeLessThanOrEqual(96);
  }
  expect(minDelay).toBeGreaterThanOrEqual(24);expect(maxSpeed).toBeLessThanOrEqual(10);expect(maxWidth).toBeLessThanOrEqual(96);
});

const SHAPES=[
 {name:'L',cells:[[0,0],[0,1],[0,2],[1,2]]},{name:'T',cells:[[0,0],[1,0],[2,0],[1,1]]},
 {name:'S',cells:[[1,0],[2,0],[0,1],[1,1]]},{name:'I',cells:[[0,0],[1,0],[2,0],[3,0]]},
 {name:'O',cells:[[0,0],[1,0],[0,1],[1,1]]},{name:'J',cells:[[1,0],[1,1],[1,2],[0,2]]}
];
function rotate(cells,t){let a=cells.map(p=>[...p]);while(t--){a=a.map(([x,y])=>[3-y,x]);const minX=Math.min(...a.map(p=>p[0])),minY=Math.min(...a.map(p=>p[1]));a=a.map(([x,y])=>[x-minX,y-minY])}return a}
function key(c){return c.map(p=>p.join(',')).sort().join('|')}

test('Shape Fit: 50,000 rounds always contain exactly one base-shape answer',()=>{
 const random=rng(203);
 for(let round=1;round<=50000;round++){
  const base=SHAPES[Math.floor(random()*SHAPES.length)], turns=round<4?0:Math.floor(random()*4);
  const answer={base,cells:rotate(base.cells,turns)};
  const count=round<6?4:round<14?6:8;
  const correctTurns=round<4?turns:(turns+1+Math.floor(random()*3))%4;
  const opts=[{base,cells:rotate(base.cells,correctTurns)}],used=new Set([base.name+':'+key(opts?.[0]?.cells||rotate(base.cells,correctTurns))]);
  let guard=0;
  while(opts.length<count&&guard++<500){
   const sh=SHAPES[Math.floor(random()*SHAPES.length)],v={base:sh,cells:rotate(sh.cells,Math.floor(random()*4))},k=sh.name+':'+key(v.cells);
   if(!used.has(k)){used.add(k);opts.push(v)}
  }
  expect(opts.length).toBe(count);
  expect(opts.filter(o=>o.base===answer.base).length).toBe(1);
 }
});

const N=6;
function cells(c){return Array.from({length:c.len},(_,n)=>[c.x+(c.h?n:0),c.y+(c.h?0:n)])}
function overlap(a,b){const s=new Set(cells(a).map(p=>p.join(',')));return cells(b).some(p=>s.has(p.join(',')))}
function canExit(list,car){const blocked=(x,y)=>list.some(o=>o!==car&&cells(o).some(([ox,oy])=>ox===x&&oy===y));if(car.h){if(car.dir>0){for(let x=car.x+car.len;x<N;x++)if(blocked(x,car.y))return false}else for(let x=car.x-1;x>=0;x--)if(blocked(x,car.y))return false}else if(car.dir>0){for(let y=car.y+car.len;y<N;y++)if(blocked(car.x,y))return false}else for(let y=car.y-1;y>=0;y--)if(blocked(car.x,y))return false;return true}
function solvable(list){const memo=new Map();function solve(rem){if(!rem.length)return true;const k=rem.map(c=>c.id).sort((a,b)=>a-b).join(',');if(memo.has(k))return memo.get(k);for(const c of rem.filter(c=>canExit(rem,c)))if(solve(rem.filter(o=>o!==c))){memo.set(k,true);return true}memo.set(k,false);return false}return solve(list)}
function trafficBoard(level,random){const target=Math.min(9,level<=1?5:level===2?6:level<=4?7:8),minBlocked=Math.min(target-1,level<=1?2:level===2?3:level<=4?4:5);for(let attempt=0;attempt<240;attempt++){const a=[];for(let id=0;id<target;id++){let placed=false;for(let t=0;t<100&&!placed;t++){const h=random()<.5,len=random()<(level>=4?.34:.18)?3:2,x=Math.floor(random()*(N-(h?len:1)+1)),y=Math.floor(random()*(N-(h?1:len)+1)),c={x,y,len,h,dir:random()<.5?-1:1,id};if(a.every(o=>!overlap(c,o))){a.push(c);placed=true}}if(!placed)break}if(a.length!==target)continue;const blocked=a.filter(c=>!canExit(a,c)).length,free=target-blocked;if(blocked<minBlocked||free<1||free>Math.max(2,Math.ceil(target*.45)))continue;if(solvable(a))return a}return null}

test('Traffic Escape: 10,000 generated boards are valid and solvable',()=>{
 const random=rng(9901);
 for(let i=0;i<10000;i++){
  const level=1+(i%7), board=trafficBoard(level,random);
  expect(board,'generator fallback at board '+i).not.toBeNull();
  expect(board.every((c,idx)=>board.every((o,j)=>idx===j||!overlap(c,o)))).toBeTruthy();
  expect(solvable(board)).toBeTruthy();
  expect(board.some(c=>canExit(board,c))).toBeTruthy();
 }
});
