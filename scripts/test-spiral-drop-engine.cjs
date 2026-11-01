const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../spiral-drop-engine.js');
function rng(seed){let n=seed;return()=>((n=(1664525*n+1013904223)>>>0)/4294967296);}
test('50,000 actual generated gaps stay varied, bounded and reachable after reaction time',()=>{
 for(let seed=1;seed<=100;seed++){
  const random=rng(seed),recent=[];let last=180,still=0,repeats=0;
  for(let i=0;i<500;i++){
   const gap=E.nextGap(i,recent,random),width=E.width(i);
   assert.ok(gap-width/2>=28&&gap+width/2<=332);
   assert.ok(width>=68);
   if(i){
    const delta=Math.abs(gap-last);assert.ok(delta<=130.0001);
    const clearTravel=(E.SPACING-E.THICKNESS-2*E.RADIUS)/E.speed(10000);
    assert.ok(.32+delta/E.KEY_SPEED<clearTravel,'320ms reaction plus keyboard travel fits between slabs');
    still=delta<30?still+1:0;assert.ok(still<2,'no free stationary chains');
    repeats=recent.length>=3&&Math.abs(gap-recent.at(-2))<20&&Math.abs(recent.at(-1)-recent.at(-3))<20?repeats+1:0;assert.ok(repeats<2,'no repeating A-B lanes');
   }
   recent.push(gap);if(recent.length>5)recent.shift();last=gap;
  }
 }
});
test('real physics survives 200 rows with a delayed keyboard pilot at 30/60/120Hz',()=>{
 for(const hz of [30,60,120])for(let seed=1;seed<=12;seed++){
  const g=E.create({random:rng(seed)}),s=g.state;let score=0,reactUntil=0,frames=0;
  while(s.alive&&s.score<200&&frames++<hz*400){
   if(s.score!==score){score=s.score;reactUntil=s.time+.32;}
   const gap=s.rows.find(r=>!r.passed).gap,delta=gap-s.x;
   const axis=s.time<reactUntil||Math.abs(delta)<E.KEY_SPEED/hz*.6?0:Math.sign(delta);
   g.advance(1/hz,axis);
  }
  assert.ok(s.alive,JSON.stringify({hz,seed,score:s.score,x:s.x,row:s.rows.find(r=>!r.passed)}));assert.equal(s.score,200);
 }
});
test('sphere edges, slab thickness, swept collisions and one-time row settlement',()=>{
 function stage(x){const g=E.create();Object.assign(g.state,{x,y:137,vy:178,wait:0});g.state.rows=[{id:0,y:150,gap:180,w:100,passed:false}];return g;}
 const edge=stage(141);edge.advance(.6);assert.equal(edge.state.alive,true);assert.equal(edge.state.score,1);edge.advance(.3);assert.equal(edge.state.score,1);
 const outside=stage(140.9);const events=outside.advance(.3);assert.equal(outside.state.alive,false);assert.equal(outside.state.score,0);assert.equal(events.filter(e=>e.type==='crash').length,1);assert.equal(outside.advance(.3).length,0);
 const crossing=stage(180);crossing.advance(.22,-1);assert.equal(crossing.state.alive,false,'cannot cross the slab sideways while overlapping');
});
test('fixed-step descent matches across refresh rates, and stationary play cannot farm rows',()=>{
 const snapshots=[];
 for(const hz of [30,60,120]){const g=E.create({random:rng(7)});for(let i=0;i<hz*2;i++)g.advance(1/hz);snapshots.push(g.state);}
 for(const s of snapshots){assert.equal(s.ticks,240);assert.ok(Math.abs(s.y-snapshots[0].y)<1e-8);}
 const g=E.create({random:rng(7)});g.advance(15);assert.equal(g.state.alive,false);assert.ok(g.state.score<=2);
});
test('center streak adds presentation only, without bonus score or currency state',()=>{
 const g=E.create();const s=g.state;Object.assign(s,{wait:0,vy:178});
 for(let i=0;i<3;i++){const y=200+i*E.SPACING;s.x=180;s.y=y-13;s.rows=[{id:i,y,gap:180,w:100,passed:false}];const events=g.advance(.5);assert.ok(events.some(e=>e.type==='clear'&&e.centered));}
 assert.equal(s.score,3);assert.equal(s.centered,3);assert.equal(s.bestStreak,3);assert.ok(s.flowUntil>s.time);assert.equal(s.coins,undefined);
});
