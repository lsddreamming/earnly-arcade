const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../star-defender-flight.js');
test('flight goals use best runs while cosmetic milestones accumulate defeats',()=>{
 let p=F.normalize(null,'2026-10-31');
 const first=F.record(p,{kills:10,wave:3,score:150,bosses:0},p.day);p=first.progress;
 assert.equal(p.totalKills,10);assert.equal(p.daily.kills,10);assert.equal(first.unlocked.length,0);
 const second=F.record(p,{kills:10,wave:2,score:100,bosses:0},p.day);p=second.progress;
 assert.equal(p.totalKills,20);assert.equal(p.daily.kills,10);assert.equal(p.daily.wave,3);assert.equal(p.daily.score,150);
 assert.deepEqual(second.unlocked.map(l=>l.id),['solar']);
 assert.ok(F.goals(p).every(g=>g.value<=g.target));
});
test('daily reset preserves colors, totals and runs without a missed-day penalty',()=>{
 const p=F.normalize({day:'2026-10-30',totalKills:80,runs:4,selected:'nova',daily:{kills:30,wave:6,score:800,bosses:1}},'2026-10-31');
 assert.equal(p.selected,'nova');assert.equal(p.totalKills,80);assert.equal(p.runs,4);
 assert.deepEqual(p.daily,{kills:0,wave:0,score:0,bosses:0});
});
test('locked and malformed colors fall back, corrupt storage cannot break play',()=>{
 assert.equal(F.normalize({totalKills:19,selected:'solar'}).selected,'comet');
 assert.equal(F.normalize({totalKills:-20,selected:'<bad>'}).totalKills,0);
 assert.equal(F.load({getItem:()=>'{broken'},'guest').selected,'comet');
 assert.equal(F.save({setItem:()=>{throw new Error('full');}},'guest',{}),false);
});
test('device progress is isolated between players and guests',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const p=F.record(null,{kills:20,wave:4,score:250},'2026-10-31').progress;
 F.save(storage,'player-a',p);
 assert.equal(F.load(storage,'player-a','2026-10-31').totalKills,20);
 assert.equal(F.load(storage,'player-b','2026-10-31').totalKills,0);
 assert.equal(F.load(storage,'','2026-10-31').totalKills,0);
});
