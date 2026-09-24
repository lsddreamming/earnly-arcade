const { test, expect } = require('@playwright/test');

// Fast deterministic model of the current Spiral Drop lane rules.
// This catches generator regressions without spending minutes manually playing.
function generateRun(count, seed = 1234567) {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const rows = [];
  let score = 0;
  const openingWidth = () => Math.max(54,112-Math.floor(score/8)*4);
  const randomGap = width => {
    const half=width/2, edge=half+28, min=edge, max=360-edge;
    const recent=rows.slice(-5);
    if(!recent.length)return 180;
    const previous=recent[recent.length-1];
    const before=recent.length>1?recent[recent.length-2]:null;
    const before2=recent.length>2?recent[recent.length-3]:null;
    const minMove=Math.max(42,width*.34);
    const maxMove=Math.max(minMove+18,Math.min(138,(max-min)*.78));
    const candidates=[];
    for(let attempt=0;attempt<40;attempt++){
      const direction=random()<.5?-1:1;
      const distance=minMove+random()*(maxMove-minMove);
      let candidate=previous+direction*distance;
      if(candidate<min)candidate=min+(min-candidate)*.55;
      if(candidate>max)candidate=max-(candidate-max)*.55;
      candidate=Math.max(min,Math.min(max,candidate));
      if(Math.abs(candidate-previous)<minMove*.82)continue;
      if(before!==null&&Math.abs(candidate-before)<26)continue;
      if(before2!==null&&Math.abs(candidate-before2)<20)continue;
      const clearance=Math.min(...recent.map(g=>Math.abs(candidate-g)));
      candidates.push({candidate,quality:clearance+random()*42});
    }
    if(candidates.length){
      candidates.sort((a,b)=>b.quality-a.quality);
      return candidates[Math.floor(random()*Math.min(8,candidates.length))].candidate;
    }
    const roomLeft=previous-min,roomRight=max-previous;
    const dir=roomRight>roomLeft?1:-1;
    return Math.max(min,Math.min(max,previous+dir*Math.min(Math.max(48,minMove),Math.max(roomLeft,roomRight)*.7)));
  };
  rows.push(180);
  while(rows.length<count){
    score=rows.length;
    rows.push(randomGap(openingWidth()));
  }
  return rows;
}

test('Spiral Drop avoids long same-lane streaks across many generated rows', () => {
  let problem=null;
  for(let seed=1; seed<=100 && !problem; seed++){
    const rows=generateRun(500,seed);
    for(let i=2;i<rows.length;i++){
      const a=Math.abs(rows[i]-rows[i-1]);
      const b=Math.abs(rows[i-1]-rows[i-2]);
      // Three nearly stationary openings in a row create the free-fall exploit.
      if(a<30 && b<30){problem={seed,row:i,a,b};break}
    }
  }
  expect(problem,'first long same-lane streak').toBeNull();
});

test('Spiral Drop does not settle into repeated A-B-A-B lanes', () => {
  let problem=null;
  for(let seed=101; seed<=200 && !problem; seed++){
    const rows=generateRun(500,seed);
    let repeated=0;
    for(let i=3;i<rows.length;i++){
      const abab=Math.abs(rows[i]-rows[i-2])<20 && Math.abs(rows[i-1]-rows[i-3])<20;
      repeated=abab?repeated+1:0;
      if(repeated>=2){problem={seed,row:i,repeated};break}
    }
  }
  expect(problem,'first repeated A-B-A-B lane streak').toBeNull();
});
