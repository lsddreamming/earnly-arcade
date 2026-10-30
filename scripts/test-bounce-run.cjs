const test=require('node:test');
const assert=require('node:assert/strict');
const {create,wave,arc}=require('../bounce-run-engine.js');
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
// Try actual frame-by-frame jumps, rather than duplicated width bounds.
test('every generated single/double has a forgiving successful launch window',()=>{
  const random=rng(781);let doubles=0;
  for(let cleared=0;cleared<=120;cleared++)for(let n=0;n<30;n++){
    const w=wave(cleared,random);if(w.obstacles.length===2)doubles++;
    let wins=0;
    const arrival=Math.floor(300/w.speed);
    for(let launch=Math.max(0,arrival-55);launch<=arrival;launch++){
      const game=create();Object.assign(game.state,{cleared,wait:10000,obstacles:w.obstacles.map(o=>({...o,x:o.x}))});
      for(let t=0;t<400&&game.state.alive&&game.state.obstacles.length;t++){
        if(t===launch)game.jump();game.step();
      }
      // A pair succeeds only when both members clear.
      if(game.state.alive&&game.state.cleared===cleared+w.obstacles.length)wins++;
      else if(game.state.alive&&game.state.cleared>cleared){
        for(let t=0;t<100&&game.state.alive&&game.state.obstacles.length;t++)game.step();
        if(game.state.alive&&!game.state.obstacles.length)wins++;
      }
    }
    assert.ok(wins>=5,JSON.stringify({cleared,w,wins}));
  }
  assert.ok(doubles>500);
});
test('generated waves allow a full landing and recovery before the next arrival',()=>{
  const random=rng(83);
  for(let cleared=0;cleared<=200;cleared++)for(let n=0;n<100;n++){
    const w=wave(cleared,random);
    assert.ok(w.delay+300/w.speed>=arc.land+14);
    assert.ok(w.obstacles.every(o=>o.speed===w.speed));
  }
});
test('early taps buffer briefly, holding is not an automatic double jump, death is final',()=>{
  const g=create();g.state.wait=10000;
  assert.equal(g.jump(),true);
  for(let i=0;i<42;i++)g.step();
  assert.equal(g.jump(),false);
  for(let i=0;i<6;i++)g.step();
  assert.equal(g.state.jumps,2);
  for(let i=0;i<100;i++)g.step();
  assert.equal(g.state.jumps,2);assert.equal(g.state.y,349);
  g.state.obstacles=[{x:80,w:20,speed:1}];g.step();assert.equal(g.state.alive,false);
  const frozen=JSON.stringify(g.state);g.step();g.jump();assert.equal(JSON.stringify(g.state),frozen);
});
