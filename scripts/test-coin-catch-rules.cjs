const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../coin-catch-rules');
const basket={x:137,y:448,w:86,h:24};
const drop=(x,eta,bomb=false)=>({x,y:441-12-eta*6/16.67,r:12,speed:6,bomb});
test('rejects unavoidable bomb/coin overlaps, overtakes and distant rapid pairs',()=>{
 assert.equal(R.route([drop(180,1000),drop(180,1000,true)],basket),false);
 assert.equal(R.route([drop(45,1000),drop(315,1100)],basket),false);
 assert.equal(R.route([drop(45,1000),drop(315,1800)],basket),true);
 assert.equal(R.route([drop(45,1000),drop(315,1000,true)],basket),true);
});
test('seeded planning across 30 levels keeps routes feasible and spans the field',()=>{
 let seed=95834;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const xs=[];let coins=0,bombs=0;
 for(let level=1;level<=30;level++)for(let i=0;i<100;i++){
  const first=R.plan([],basket,level,random);assert.ok(first);xs.push(first.x);
  const pending=[first];
  for(let j=0;j<6;j++){
   // Advance the entire wave without removing existing scheduled obligations.
   for(const d of pending)d.y+=d.speed*310/16.67;
   const next=R.plan(pending,basket,level,random);
   if(next){assert.ok(R.route([...pending,next],basket));pending.push(next);next.bomb?bombs++:coins++;}
   for(let k=pending.length-1;k>=0;k--)if(pending[k].y+pending[k].r>441)pending.splice(k,1);
  }
 }
 assert.ok(Math.min(...xs)<25);assert.ok(Math.max(...xs)>335);assert.ok(coins>1000);assert.ok(bombs>1000);
});
test('unsafe scheduling skips rather than forcing a fallback',()=>{
 assert.equal(R.plan([drop(180,1000),drop(180,1000,true)],basket,30,()=>.5),null);
});
test('medals accumulate best performances only and remain scoped to the device account',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 let p=R.record(null,10,4);assert.equal(R.goal(p).name,'First Spark');
 p=R.record(p,2,5);assert.equal(R.goal(p).name,'Gold Gatherer');
 R.save(storage,'alice',p);assert.deepEqual(R.load(storage,'alice'),p);assert.equal(R.load(storage,'bob').runs,0);
 assert.equal(R.goal(R.record(p,200,30)),null);
 assert.deepEqual(R.load({getItem:()=>'{bad'},'alice'),{score:0,streak:0,runs:0});
 assert.doesNotThrow(()=>R.save({setItem:()=>{throw Error('quota');}},'alice',p));
});
