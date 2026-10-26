const {test}=require('@playwright/test');
const assert=require('node:assert/strict');
const E=require('../bubble-pop-engine');
const rng=seed=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
test('1000 campaign definitions have bounded goals, deterministic playable boards and varied layouts',()=>{
 const layouts=new Set(),goals=new Set();for(let l=0;l<1000;l++){const r=E.levelRules(l),g=E.create(rng(37),l),s=g.state();assert.deepEqual(s,E.create(rng(37),l).state());assert.equal(s.ice.filter(Boolean).length,r.ice);assert.equal(s.board.filter(c=>c.star).length,r.stars);assert(r.moves>=22&&r.moves<=35);assert(r.ice<=16);assert(r.collect<=30);assert(r.stars<=3);assert(r.ice+r.collect+r.stars>0);assert.equal(E.matches(s.board).length,0);assert(g.legalMoves().length);layouts.add(s.ice.join('')+s.board.map(c=>Number(c.star)).join(''));goals.add([r.color,r.collect,r.ice,r.stars].join(','));}assert(layouts.size>50);assert(goals.size>30);
});
test('1000 seeded rounds conserve stars, unique cells, score and moves across every campaign level',()=>{
 test.setTimeout(120000);let turns=0,wins=0,cascades=0;for(let level=0;level<1000;level++){const random=rng(level+71),g=E.create(random,level);while(!g.state().done){const s=g.state(),available=g.legalMoves();assert(available.length);const r=g.swap(...available[Math.floor(random()*available.length)]);turns++;assert(r.valid);assert.equal(r.moves,s.moves-1);assert(r.score>s.score);assert.equal(r.board.length,56);assert.equal(new Set(r.board.map(c=>c.id)).size,56);assert.equal(r.board.filter(c=>c.star).length+r.goals.delivered,E.levelRules(level).stars);assert(r.goals.iceLeft<=s.goals.iceLeft);assert(r.goals.collected>=s.goals.collected);assert(r.progress>=s.progress&&r.progress<=1);assert.equal(E.matches(r.board).length,0);for(const c of r.board)assert(c.star||c.power||Number.isInteger(c.color)&&c.color>=0&&c.color<5);if(r.combo>1)cascades++;}
 const end=g.state();assert.equal(g.swap(0,1).valid,false);assert.deepEqual(g.state(),end);if(end.status==='won'){wins++;assert.equal(end.progress,1);}else assert.equal(end.moves,0);g.restart();assert.equal(g.state().score,0);assert.equal(g.state().moves,E.levelRules(level).moves);}
 assert(wins>0);assert(cascades>0);console.log(JSON.stringify({rounds:1000,turns,wins,cascades,note:'Random policy, not a human balance assessment'}));
});
test('bad saves and constant RNG cannot cause unbounded generation or cascade loops',()=>{
 for(const value of [NaN,Infinity,-Infinity,'bad',-50])assert.equal(E.create(rng(1),value).state().level,0);assert.equal(E.create(rng(1),999999).state().level,999);assert.equal(E.create(rng(1),6.9).state().level,6);
 for(const n of [0,.8,NaN,1]){const g=E.create(()=>n);assert.equal(E.matches(g.state().board).length,0);const r=g.swap(...g.legalMoves()[0]);assert(r.valid);assert(r.waves.length<=32);assert.equal(E.matches(r.board).length,0);assert.equal(r.moves,E.levelRules(0).moves-1);}
});
