const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../color-match-engine.js');
test('20,000 actual prompts have four unique choices, one answer, varied positions and no immediate repeats',()=>{
 let seed=937;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 let previous=null;
 for(let i=0;i<20000;i++){
  const score=i%60,round=engine.nextRound(previous,score,random);
  assert.equal(new Set(round.choices.map(c=>c[0])).size,4);
  assert.equal(round.choices.filter(c=>c[0]===round.ink).length,1);
  assert.equal(round.choices[round.position][0],round.ink);
  assert.ok(engine.colors.some(c=>c[0]===round.ink&&c[1]===round.hex));
  if(previous)assert.notEqual(round.word+'|'+round.ink,previous.word+'|'+previous.ink);
  if(score>=8)assert.notEqual(round.word,round.ink);
  assert.ok(round.inkRun<=2);assert.ok(round.positionRun<=2);previous=round;
 }
});
test('bounded generation also works with constant and malformed randomness',()=>{
 for(const value of [0,.5,.999999,1,-1,NaN,Infinity]){
  let previous=null;
  for(let i=0;i<100;i++){const round=engine.nextRound(previous,i,()=>value);assert.equal(round.choices.length,4);assert.ok(round.inkRun<=2);assert.ok(round.positionRun<=2);previous=round}
 }
});
test('four cosmetic stages unlock at the advertised match thresholds',()=>{
 assert.deepEqual([0,7,8,17,18,29,30,100].map(n=>engine.stage(n).name),['Focus','Focus','Flow','Flow','Overdrive','Overdrive','Prism','Prism']);
});
