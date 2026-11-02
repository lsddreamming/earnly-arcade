const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../traffic-escape-engine.js');
function seeded(seed){return()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
test('3500 actual city boards have exact counts, legal positions and complete exit orders',()=>{
 for(let i=0;i<3500;i++){
  const level=1+i%7,b=E.generate(level,seeded(i+18));assert.equal(b.length,E.COUNTS[level-1]);
  assert.equal(new Set(b.map(c=>c.id)).size,b.length);
  for(const c of b){assert.ok(E.cells(c).every(([x,y])=>x>=0&&x<6&&y>=0&&y<6));assert.ok(b.every(o=>c===o||!E.overlap(c,o)));}
  const free=b.filter(c=>E.canExit(b,c));assert.ok(free.length>=1&&free.length<=2);
  const order=E.solution(b);assert.equal(order.length,b.length);let remaining=b;
  for(const id of order){const c=remaining.find(c=>c.id===id);assert.ok(E.canExit(remaining,c));remaining=remaining.filter(o=>o!==c);}
 }
});
test('fallback keeps density and solvability with constant, out-of-range and invalid randomness',()=>{
 for(const value of [0,.5,1,NaN,Infinity,-1])for(let l=1;l<=7;l++){const b=E.generate(l,()=>value);assert.equal(b.length,E.COUNTS[l-1]);assert.equal(E.solution(b).length,b.length);assert.ok(b.filter(c=>E.canExit(b,c)).length<=2);}
});
test('one input commits one car and the seven-road campaign ends at 59 without score multipliers',()=>{
 for(const hz of [30,60,120]){
  const g=E.create(seeded(31)),s=g.state;g.start();let steps=0;
  while(s.phase!=='over'&&steps++<30000){
   if(s.phase==='play'){const c=s.cars.find(c=>E.canExit(s.cars,c)),before=s.cleared;assert.ok(g.tap(c.id));assert.equal(g.tap(c.id),false);assert.equal(s.cleared,before);}
   g.advance(1/hz);
  }
  assert.equal(s.reason,'complete');assert.equal(s.cleared,59);assert.equal(s.roads,7);assert.equal(s.cleanRoads,7);assert.equal(s.bestStreak,59);const snapshot=JSON.stringify(s);g.advance(100);g.tap(0);assert.equal(JSON.stringify(s),snapshot);
 }
});
test('deadline cannot accept late input; a valid committed final exit settles exactly once',()=>{
 const g=E.create(seeded(7));g.start();g.advance(16.01);assert.equal(g.state.reason,'timeout');assert.equal(g.tap(g.state.cars[0].id),false);assert.equal(g.state.cleared,0);
 const h=E.create(seeded(7));h.start();const s=h.state,c=s.cars.find(c=>E.canExit(s.cars,c));s.cars=[c];s.remaining=.02;assert.ok(h.tap(c.id));h.advance(.18);assert.equal(s.cleared,1);assert.equal(s.roads,1);assert.equal(s.phase,'transition');h.advance(.74);assert.equal(s.level,1);h.advance(.02);assert.equal(s.level,2);assert.ok(s.remaining>13.9);
});
test('three blocked decisions end the run, with a cooldown against accidental double taps',()=>{
 const g=E.create(seeded(13)),s=g.state;g.start();const c=s.cars.find(c=>!E.canExit(s.cars,c));
 for(let i=1;i<=3;i++){g.tap(c.id);g.tap(c.id);assert.equal(s.strikes,i);if(i<3)g.advance(.31);}
 assert.equal(s.reason,'crashes');assert.equal(s.cleared,0);assert.equal(s.streak,0);const t=s.remaining;g.advance(5);assert.equal(s.remaining,t);
});
test('elapsed clocks are independent of frame rate, long stalls, and transition celebrations',()=>{
 for(const hz of [30,60,120]){const g=E.create(seeded(20));g.start();for(let i=0;i<hz*3;i++)g.advance(1/hz);assert.ok(Math.abs(g.state.remaining-13)<1e-8);g.advance(100);assert.equal(g.state.reason,'timeout');}
 const g=E.create(seeded(12));g.start();const before=JSON.stringify(g.state);for(const bad of [0,-1,Infinity,NaN])g.advance(bad);assert.equal(JSON.stringify(g.state),before);
});
