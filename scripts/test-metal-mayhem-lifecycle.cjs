const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../metal-mayhem-engine.js');

// Execute the shipped controller and real simulation. Only browser surfaces are
// stubbed; the Playwright suite separately exercises the rendered game.
function setup(path,{coarse=true,start=async()=>null}={}){
 const target=()=>{
  const listeners=new Map();
  return {
   addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},
   emit(name,fields={}){for(const fn of listeners.get(name)||[])fn({preventDefault(){},stopPropagation(){},...fields});}
  };
 };
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   ...target(),hidden:true,style:{},dataset:{},classList:{add(){},remove(){}},
   append(){},replaceChildren(){},setPointerCapture(){},
   getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})
  });
  return elements.get(id);
 };
 const document={...target(),hidden:false,getElementById:element,createTextNode:x=>x,createElement:()=>element(Symbol())};
 let renderFrame,now=100;
 const window={...target(),MetalMayhem:engine,MetalMayhemRewards:{start,createSession:()=>null},
  MetalMayhemView:class{reset(){}render(){}effects(){}resize(){}}};
 vm.runInNewContext(fs.readFileSync(path,'utf8'),{
  window,document,console,matchMedia:()=>({matches:coarse}),
  localStorage:{getItem:()=>null,setItem(){}},location:{search:'?qa=1'},URLSearchParams,
  performance:{now:()=>now},crypto:require('node:crypto').webcrypto,
  requestAnimationFrame:fn=>{renderFrame=fn;},setTimeout(){},innerWidth:390
 });
 return {window,document,element,qa:window.__metalMayhem,
  frame(){now+=40;renderFrame(now);},
  visibility(hidden){document.hidden=hidden;document.emit('visibilitychange');}
 };
}
for(const path of ['metal-mayhem.js','www/metal-mayhem.js']){
 test(`${path}: visible touch blur clears held controls without reopening Pause`,async()=>{
  const t=setup(path);await t.element('start').onclick();
  for(let i=0;i<3;i++){
   t.document.emit('keydown',{code:'KeyW'});
   t.element('attack').emit('pointerdown',{pointerId:1});
   assert.equal(t.qa.input.z,-1);assert.equal(t.qa.input.attack,true);
   t.window.emit('blur');
   assert.equal(t.qa.input.z,0);assert.equal(t.qa.input.attack,false);
   assert.equal(t.qa.paused,false);assert.equal(t.element('pauseScreen').hidden,true);
   const tick=t.qa.state.tick;t.frame();assert(t.qa.state.tick>tick);
   t.element('pause').onclick();assert.equal(t.qa.paused,true);
   t.element('resume').onclick();assert.equal(t.qa.paused,false);
  }
 });
 test(`${path}: desktop window blur still pauses`,async()=>{
  const t=setup(path,{coarse:false});await t.element('start').onclick();
  t.window.emit('blur');assert.equal(t.qa.paused,true);
  const tick=t.qa.state.tick;t.frame();assert.equal(t.qa.state.tick,tick);
 });
 test(`${path}: hidden run cannot resume and return waits for user`,async()=>{
  const t=setup(path);await t.element('start').onclick();t.visibility(true);
  assert.equal(t.qa.paused,true);const tick=t.qa.state.tick;
  t.element('resume').onclick();assert.equal(t.qa.paused,true);
  t.frame();assert.equal(t.qa.state.tick,tick);
  t.visibility(false);assert.equal(t.qa.paused,true);
  t.element('resume').onclick();t.frame();assert(t.qa.state.tick>tick);
 });
 test(`${path}: pagehide pauses even without a visibility event`,async()=>{
  const t=setup(path);await t.element('start').onclick();
  t.window.emit('pagehide');assert.equal(t.qa.paused,true);
  t.window.emit('pageshow');assert.equal(t.qa.paused,true);
  t.element('resume').onclick();assert.equal(t.qa.paused,false);
 });
 test(`${path}: asynchronous entry finishing in background stays paused`,async()=>{
  let finish;const t=setup(path,{start:()=>new Promise(resolve=>{finish=resolve;})});
  const entry=t.element('start').onclick();t.visibility(true);finish(null);await entry;
  assert.equal(t.qa.paused,true);t.frame();assert.equal(t.qa.state.tick,0);
  t.visibility(false);t.element('resume').onclick();t.frame();assert(t.qa.state.tick>0);
 });
}
