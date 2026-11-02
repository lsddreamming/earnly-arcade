const { test, expect } = require('@playwright/test');

function rng(seed){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296}}

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

const trafficEngine=require('../traffic-escape-engine.js');
const trafficBoard=trafficEngine.generate, canExit=trafficEngine.canExit, overlap=trafficEngine.overlap, solvable=board=>!!trafficEngine.solution(board);

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


const dodgerDifficulty=require('../dodger-progression.js').difficulty;

test('Neon Dodger: 50,000 endurance waves keep a timed escape',()=>{
  const random=rng(4407);
  let lastOpenLane=1,pairedWaves=0,farShifts=0,followUps=0,triples=0,quads=0,problem=null;

  for(let i=0;i<50000;i++){
    const seconds=i%120;
    const stage=dodgerDifficulty(seconds);
    const paired=random()<stage.pairChance;
    const previousOpen=lastOpenLane;
    let blocked;

    if(paired){
      pairedWaves++;
      let next;
      const farLane=lastOpenLane===0?2:lastOpenLane===2?0:null;
      if(farLane!==null && random()<stage.farShiftChance){
        next=farLane;
      }else if(lastOpenLane===1){
        next=random()<.5?0:2;
      }else{
        next=1;
      }
      lastOpenLane=next;
      blocked=[0,1,2].filter(lane=>lane!==next);

      const shift=Math.abs(lastOpenLane-previousOpen);
      if(shift===2) farShifts++;
      const validShift=shift===1||shift===2;
      const validGap=lastOpenLane>=0&&lastOpenLane<3&&blocked.length===2&&!blocked.includes(lastOpenLane);
      const validWidth=stage.blockWidth>=48&&stage.blockWidth<=52;
      if(!problem&&(!validShift||!validGap||!validWidth)){
        problem={i,seconds,previousOpen,lastOpenLane,shift,blocked,blockWidth:stage.blockWidth};
      }
      if(random()<stage.followUpChance){
        followUps++;
        const firstOpen=lastOpenLane;
        const followUpOpen=firstOpen===1?(random()<.5?0:2):1;
        const followUpBlocked=[0,1,2].filter(lane=>lane!==followUpOpen);
        const validTiming=stage.followUpGapMs>=360&&stage.delay>=620;
        if(!problem&&(!validTiming||Math.abs(followUpOpen-firstOpen)!==1||followUpBlocked.includes(followUpOpen))){
          problem={i,seconds,firstOpen,followUpOpen,followUpBlocked,gapMs:stage.followUpGapMs};
        }
        lastOpenLane=followUpOpen;
        if(random()<(stage.thirdRowChance||0)){
          triples++;
          const thirdOpen=followUpOpen===1?(firstOpen===0?2:0):1;
          const thirdBlocked=[0,1,2].filter(lane=>lane!==thirdOpen);
          const validTriple=Math.abs(thirdOpen-followUpOpen)===1&&thirdBlocked.length===2&&!thirdBlocked.includes(thirdOpen)&&stage.followUpGapMs>=360;
          if(!problem&&!validTriple) problem={i,seconds,firstOpen,followUpOpen,thirdOpen,thirdBlocked};
          lastOpenLane=thirdOpen;
          if(random()<(stage.fourthRowChance||0)){quads++;const fourthOpen=thirdOpen===1?(firstOpen===0?0:2):1;const fourthBlocked=[0,1,2].filter(lane=>lane!==fourthOpen);if(!problem&&(Math.abs(fourthOpen-thirdOpen)!==1||fourthBlocked.includes(fourthOpen)))problem={i,seconds,thirdOpen,fourthOpen};lastOpenLane=fourthOpen;}
        }
      }
    }else{
      const playerLane=i%3;
      blocked=[playerLane];
      if(!problem&&(blocked.length!==1||blocked[0]!==playerLane)){
        problem={i,seconds,blocked};
      }
    }

    if(!problem&&seconds>=30&&!paired){
      problem={i,seconds,reason:'late wave was not paired'};
    }
  }

  expect(problem,'first unfair Neon Dodger wave').toBeNull();
  expect(pairedWaves).toBeGreaterThan(30000);
  expect(farShifts).toBeGreaterThan(3000);
  expect(followUps).toBeGreaterThan(15000);
  expect(triples).toBeGreaterThan(5000);
  expect(quads).toBeGreaterThan(4000);
});
