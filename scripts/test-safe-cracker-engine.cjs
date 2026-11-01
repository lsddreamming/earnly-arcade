const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../safe-cracker-engine');
let seed=39128;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
test('every generated pin offers two fair full target traversals with reaction time',()=>{
 const modes=new Set();
 for(const score of [0,4,5,15,33,50,100,200,1000])for(let i=0;i<100;i++){
  const c=E.create(score,i%30,random);modes.add(c.mode);
  assert.ok(c.x>=28&&c.x+c.width<=332);
  let firstHit=Infinity,currentWindow=0,fullWindows=0;
  // Independent clock sampling checks actual generated motion, not just its parameters.
  for(let t=0;t<=c.limit;t+=2){const s=E.sample(c,t),inside=s.marker>=c.x&&s.marker<=c.x+c.width;
   assert.ok(s.marker>=28-1e-7&&s.marker<=332+1e-7);
   if(inside){firstHit=Math.min(firstHit,t);currentWindow+=2;}else if(currentWindow){assert.ok(currentWindow>=124,'timing window too short: '+currentWindow);fullWindows++;currentWindow=0;}
  }
  assert.ok(firstHit>=230,'target overlaps the spawn reaction zone');assert.ok(fullWindows>=2,'two complete chances must fit before timeout');
 }
 assert.deepEqual([...modes].sort(),['pulse','steady','surge','vault']);
});
test('clock-based movement matches at 30, 60 and 120Hz and has no hidden jump',()=>{
 for(const score of [0,15,100])for(let i=0;i<20;i++){
  const c=E.create(score,i,random),expected=E.sample(c,2000);
  for(const fps of [30,60,120]){let state;for(let frame=0;frame<=fps*2;frame++)state=E.sample(c,frame*1000/fps);assert.ok(Math.abs(state.marker-expected.marker)<1e-9);}
  for(let t=1;t<c.limit;t+=10)assert.ok(Math.abs(E.sample(c,t).marker-E.sample(c,t-1).marker)<=.363,'movement exceeds declared speed ceiling');
 }
});
test('perfect is optional, edge hits count, and every tenth door requires two pins',()=>{
 assert.equal(E.grade(100,100,50),'clean');assert.equal(E.grade(150,100,50),'clean');assert.equal(E.grade(125,100,50),'perfect');assert.equal(E.grade(99.9,100,50),'miss');
 for(let cleared=0;cleared<50;cleared++){const c=E.create(33,cleared,random);assert.equal(c.pins,(cleared+1)%10===0?2:1);}
});
