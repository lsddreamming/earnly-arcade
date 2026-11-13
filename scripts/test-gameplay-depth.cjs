const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const rules=require('../shape-fit-rules.js');

// Independent geometric oracle: compare silhouettes under all quarter turns.
function family(cells){
  const views=[];let points=cells.map(p=>p.slice());
  for(let n=0;n<4;n++){
    const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1]));
    views.push(points.map(p=>[p[0]-x,p[1]-y].join(',')).sort().join(';'));
    points=points.map(([a,b])=>[-b,a]);
  }
  return views.sort()[0];
}
test('bounded Shape Fit generation stays unambiguous even with repeated randomness',()=>{
  const original=JSON.stringify(rules.shapes);
  assert.equal(new Set(rules.shapes.map(s=>family(s.cells))).size,6);
  for(const random of [()=>0,()=>.5,()=>.999999])for(const n of [1,3,4,7,8,13,14,16,500]){
    const r=rules.round(n,random),f=family(r.target.cells);
    assert.equal(r.choices.length,n<=3?3:n<=7?4:n<=13?6:8);
    assert.equal(r.choices.filter(s=>family(s.cells)===f).length,1);
    assert.equal(new Set(r.choices.map(s=>s.cells.map(p=>p.join(',')).sort().join(';'))).size,r.choices.length);
    for(const s of [r.target,...r.choices])for(const [x,y] of s.cells){assert.ok(x>=0&&x<4&&y>=0&&y<4);}
  }
  assert.equal(JSON.stringify(rules.shapes),original);
});
test('Shape Fit keeps its time budget, stage progression and next goals',()=>{
  assert.deepEqual([1,3,4,8,9,14,16,100].map(n=>rules.round(n,()=>.5).duration),[7000,7000,6380,5500,5280,4180,3740,2800]);
  assert.deepEqual([3,4,8,9,15,16].map(n=>rules.round(n).stage),['Warm-up','Rotation challenge','Rotation challenge','Quick Match','Quick Match','Expert Shapes']);
  assert.deepEqual([0,5,10,20,35,50,75].map(rules.nextGoal),[5,10,20,35,50,75,100]);
});

const html=fs.readFileSync('lanerunner.html','utf8');
function steering(){
  const listeners={};
  const element=name=>({name,textContent:'',contains:t=>t?.name===name,setPointerCapture(){},releasePointerCapture(){},addEventListener(type,fn){listeners[name+':'+type]=fn;}});
  const elements=Object.fromEntries(['game','laneControlZone','laneLeft','laneRight','lanePosition'].map(n=>[n,element(n)]));
  const document={body:{classList:{contains:()=>false}},getElementById:n=>elements[n],addEventListener(type,fn){listeners['document:'+type]=fn;}};
  const state={document,canvas:elements.game,laneControlZone:elements.laneControlZone,running:true,starting:false,pauseStartedAt:0,lane:1,targetLane:1,startGame(){},Arcade:{feedback(){},isProtectedGameControlTarget:t=>!!t?.protected,inExpandedGameZone:()=>true}};
  vm.createContext(state);
  vm.runInContext(html.slice(html.indexOf('    function setLane('),html.indexOf('    let earnlyRunStartedAt='))+html.slice(html.indexOf('    let lanePointer='),html.indexOf('    function pauseLaneRunner()')),state);
  const fire=(owner,type,more={})=>listeners[owner+':'+type]({pointerId:1,isPrimary:true,pointerType:'touch',button:0,clientX:100,clientY:100,target:elements[owner],currentTarget:elements[owner],preventDefault(){},...more});
  return {state,fire};
}
test('Lane Runner consumes one lane change per gesture and ignores other fingers',()=>{
  const {state:s,fire}=steering();fire('game','pointerdown');
  fire('game','pointerdown',{pointerId:2,isPrimary:false});fire('document','pointermove',{pointerId:2,clientX:200});assert.equal(s.lane,1);
  fire('document','pointermove',{clientX:135});assert.equal(s.lane,2);
  fire('document','pointermove',{clientX:30});fire('document','pointerup',{clientX:30});assert.equal(s.lane,2);
  fire('laneLeft','click');assert.equal(s.lane,1);fire('laneLeft','click');fire('laneLeft','click');assert.equal(s.lane,0);
});
test('Lane Runner rejects diagonals, cancellations and protected controls',()=>{
  for(const cancellation of ['pointercancel','lostpointercapture']){
    const {state:s,fire}=steering();fire('game','pointerdown');fire('document','pointermove',{clientX:140,clientY:150});assert.equal(s.lane,1);
    fire(cancellation==='pointercancel'?'document':'game',cancellation);fire('document','pointermove',{clientX:200});assert.equal(s.lane,1);
    fire('game','pointerdown',{target:{protected:true}});fire('document','pointermove',{clientX:200});assert.equal(s.lane,1);
  }
});
test('Lane Runner pause clears gestures and held keys do not skip lanes',()=>{
  const {state:s,fire}=steering();fire('game','pointerdown');s.clearLaneGesture();s.pauseStartedAt=100;
  fire('laneRight','click');fire('document','keydown',{key:'ArrowRight'});assert.equal(s.lane,1);
  s.pauseStartedAt=0;fire('document','pointermove',{clientX:200});assert.equal(s.lane,1);
  fire('document','keydown',{key:'ArrowLeft',repeat:true});assert.equal(s.lane,1);
  fire('document','keydown',{key:'ArrowLeft',target:{closest:()=>true}});assert.equal(s.lane,1);
  fire('document','keydown',{key:'ArrowLeft'});assert.equal(s.lane,0);
});
test('web and native assets match and changed scripts parse',()=>{
  for(const file of ['lanerunner.html','lane-runner.css','mini.html','mini-games.js','shape-fit.css','shape-fit-rules.js','game-guides.html'])assert.equal(fs.readFileSync(file,'utf8'),fs.readFileSync('www/'+file,'utf8'),file);
  for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script);
  new vm.Script(fs.readFileSync('mini-games.js','utf8'));
});
