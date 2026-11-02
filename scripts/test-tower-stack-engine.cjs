const {test}=require('node:test');const assert=require('node:assert/strict');const engine=require('../tower-stack-engine.js');
test('perfect tolerance, left/right cutoffs and complete misses retain existing rules',()=>{
 const prev={x:85,w:190};
 for(const x of [80,85,90])assert.deepEqual(engine.placement(prev,{x,w:190}),{miss:false,perfect:true,x:85,w:190,cut:null});
 assert.deepEqual(engine.placement(prev,{x:75,w:190}),{miss:false,perfect:false,x:85,w:180,cut:{x:75,w:10}});
 assert.deepEqual(engine.placement(prev,{x:95,w:190}),{miss:false,perfect:false,x:95,w:180,cut:{x:275,w:10}});
 for(const x of [-105,275,400])assert.equal(engine.placement(prev,{x,w:190}).miss,true);
});
test('20,000 placements conserve retained and falling width and never grow the platform',()=>{
 let seed=93;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<20000;i++){
  const previous={x:rand()*160,w:10+rand()*180},moving={x:rand()*360-90,w:previous.w},r=engine.placement(previous,moving);
  if(r.miss)continue;
  assert.ok(r.w>0&&r.w<=previous.w);assert.ok(r.x>=previous.x&&r.x+r.w<=previous.x+previous.w+1e-9);
  if(!r.perfect)assert.ok(Math.abs(r.w+r.cut.w-moving.w)<1e-8);
 }
});
test('30, 60 and 120 Hz travel identical distances including wraps in both directions',()=>{
 for(const dir of [-1,1])for(const floors of [0,10,54,200]){
  const positions=[30,60,120].map(hz=>{let x=85;for(let i=0;i<hz*10;i++)x=engine.advance(x,190,360,dir,engine.speedFor(floors),1000/hz);return x});
  assert.ok(Math.max(...positions)-Math.min(...positions)<1e-6);
 }
 assert.equal(engine.speedFor(0),2.6);assert.equal(engine.speedFor(1000),6.3);
});
test('district heights are cosmetic and have fixed advertised thresholds',()=>{
 assert.deepEqual([0,9,10,24,25,49,50,99,100].map(n=>engine.district(n).name),['Harbor Lights','Harbor Lights','City Rise','City Rise','Cloudline','Cloudline','Stratosphere','Stratosphere','Orbit']);
});
