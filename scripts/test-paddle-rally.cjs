const {test}=require('node:test');
const assert=require('node:assert/strict');
const Rally=require('../paddle-rally-engine.js');
const paddle=()=>({x:132,y:458,w:96,h:14});
test('fast returns use the contact point and never tunnel through the paddle',()=>{
  const p=paddle(),b={x:130,y:440,r:7,dx:600,dy:780};
  const events=Rally.step(b,p,.05,30);
  assert.equal(events.filter(e=>e.kind==='paddle').length,1);
  assert.ok(b.dy<0&&b.y<451);
  assert.ok(events[0].x>138&&events[0].x<139);
});
test('a wall and paddle collision resolve in time order within one frame',()=>{
  const p={...paddle(),x:264},b={x:350,y:435,r:7,dx:500,dy:780};
  const events=Rally.step(b,p,.05,35);
  assert.deepEqual(events.map(e=>e.kind),['right','paddle','right']);
  assert.ok(b.x<=353&&b.dy<0);
});
test('genuine misses do not get rescued by a late horizontal overlap',()=>{
  const p=paddle(),b={x:116,y:440,r:7,dx:400,dy:780};
  const events=Rally.step(b,p,.05,1);
  assert.equal(events.some(e=>e.kind==='paddle'),false);
  assert.ok(b.dy>0);
  assert.equal(Rally.step(b,p,.05,1).at(-1).kind,'miss');
});
test('center and edge hits are aimable, bounded and never perfectly vertical',()=>{
  for(const hit of [-1,-.5,0,.5,1]){
    const p=paddle(),b={x:180+48*hit,y:450,r:7,dx:0,dy:500};
    const event=Rally.step(b,p,.01,10)[0];
    assert.equal(event.kind,'paddle');assert.equal(event.center,hit===0);
    assert.ok(b.dy<0&&Math.abs(b.dx)>0);
    if(hit!==0)assert.equal(Math.sign(b.dx),Math.sign(hit));
    assert.ok(Math.abs(Math.hypot(b.dx,b.dy)-Rally.speedFor(11))<1e-8);
  }
});
test('difficulty progresses smoothly with a reachable speed and paddle ceiling',()=>{
  let previous=Rally.baseSpeed;
  for(let score=0;score<10000;score++){
    const speed=Rally.speedFor(score),w=Rally.widthFor(score);
    assert.ok(speed>=previous&&speed<=780&&speed-previous<15);
    assert.ok(w>=76&&w<=96);previous=speed;
  }
});
test('30, 60 and 120 fps agree across wall and paddle impacts',()=>{
  function simulate(fps){const p=paddle(),b={x:350,y:420,r:7,dx:440,dy:600};p.x=264;let score=0;for(let i=0;i<fps;i++)for(const e of Rally.step(b,p,1/fps,score))if(e.kind==='paddle')score=e.score;return {...b,score}}
  const baseline=simulate(120);
  for(const fps of [30,60]){const value=simulate(fps);assert.equal(value.score,baseline.score);for(const k of ['x','y','dx','dy'])assert.ok(Math.abs(value[k]-baseline[k])<1e-6,k)}
});
test('an untouched center paddle cannot farm an endless vertical rally',()=>{
  const p=paddle(),b={x:180,y:450,r:7,dx:0,dy:360};let score=0,missed=false;
  for(let i=0;i<60*60&&!missed;i++)for(const e of Rally.step(b,p,1/60,score)){if(e.kind==='paddle')score=e.score;if(e.kind==='miss')missed=true}
  assert.ok(missed);assert.ok(score<10);
});
