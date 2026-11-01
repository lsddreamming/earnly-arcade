const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('../perfect-drop-engine.js');
function rng(seed){let n=seed;return()=>((n=(1664525*n+1013904223)>>>0)/4294967296);}
test('1,000 generated rounds offer two complete 200ms catch windows and reaction time',()=>{
 let modes=new Set();for(let seed=1;seed<=10;seed++){const random=rng(seed),recent=[];for(let hits=0;hits<100;hits++){
  const r=E.round(hits,random,recent);recent.push(r.center);if(recent.length>2)recent.shift();modes.add(r.type);
  assert.ok(r.center-r.w/2>=E.LEFT&&r.center+r.w/2<=E.RIGHT);
  let start=null,first=null,windows=[];
  for(let ms=0;ms<=r.limit*1000;ms++){
   const hit=E.landing(r,E.position(r,ms/1000)).hit;
   if(hit&&start===null){start=ms;if(first===null)first=ms;}
   if(!hit&&start!==null){windows.push(ms-start);start=null;}
  }
  assert.ok(first>=320,JSON.stringify({hits,r,first}));assert.ok(windows.length>=2,JSON.stringify({hits,r,windows}));assert.ok(windows.every(w=>w>=198),JSON.stringify({hits,r,windows}));
 }}assert.equal(modes.size,2);
});
test('whole-orb edge clearance and gold-center classification use the drawn geometry',()=>{
 const r=E.round(70,rng(2)),safe=r.w/2-E.RADIUS;
 assert.equal(E.landing(r,r.center-safe).hit,true);assert.equal(E.landing(r,r.center+safe).hit,true);assert.equal(E.landing(r,r.center+safe+.01).hit,false);assert.equal(E.landing(r,r.center-safe-.01).hit,false);assert.equal(E.landing(r,r.center).perfect,true);assert.equal(E.landing(r,r.center+safe).perfect,false);
});
test('a committed drop freezes its position, completes once, and ignores duplicate inputs',()=>{
 const g=E.create(),s=g.state;g.advance(1);const x=s.x;assert.ok(g.commit());for(let i=0;i<100;i++)assert.equal(g.commit(),false);const center=s.round.center;g.advance(.25);assert.equal(s.dropX,x);assert.equal(s.round.center,center);assert.ok(s.fall>0&&s.fall<1);
 const e=g.advance(.3);assert.equal(e.filter(e=>e.type==='hit'||e.type==='miss').length,1);assert.equal(s.attempts,1);assert.equal(g.advance(.1).length,0);
});
test('three perfects give cosmetic Skyfire and exactly three score hits',()=>{
 const g=E.create({random:rng(8)}),s=g.state;for(let i=0;i<3;i++){s.x=s.round.center;assert.ok(g.commit());g.advance(E.FLIGHT+E.HOLD+.03);}
 assert.equal(s.hits,3);assert.equal(s.perfects,3);assert.equal(s.bestPerfectChain,3);assert.ok(s.flareUntil>s.time);assert.equal(s.coins,undefined);
});
test('idle timeouts, late commits, final results and restart guards settle only once',()=>{
 const g=E.create({random:rng(9)}),s=g.state;const events=g.advance(30);assert.equal(s.phase,'over');assert.equal(s.lives,0);assert.equal(s.hits,0);assert.equal(s.attempts,3);assert.equal(events.filter(e=>e.type==='over').length,1);const ticks=s.ticks;assert.equal(g.advance(30).length,0);assert.equal(s.ticks,ticks);assert.equal(g.commit(),false);
 const late=E.create();late.state.aimTime=late.state.round.limit;assert.equal(late.commit(),false);assert.equal(late.state.lives,2);assert.equal(late.state.phase,'feedback');
});
test('the same timing pilot clears 100 rounds at 30/60/120Hz without lives or score bonuses',()=>{
 for(const hz of [30,60,120])for(let seed=1;seed<=5;seed++){
  const g=E.create({random:rng(seed)}),s=g.state;let frames=0;
  while(s.hits<100&&s.phase!=='over'&&frames++<hz*400){if(s.phase==='aim'&&s.aimTime>.32&&E.landing(s.round,s.x).perfect)g.commit();g.advance(1/hz);}
  assert.equal(s.hits,100,JSON.stringify({hz,seed,s}));assert.equal(s.lives,3);assert.equal(s.attempts,100);
 }
 const values=[];for(const hz of [30,60,120]){const g=E.create();for(let i=0;i<hz;i++)g.advance(1/hz);values.push(g.state.x);assert.equal(g.state.ticks,120);}assert.ok(values.every(v=>Math.abs(v-values[0])<1e-8));
});
