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
 test(`${path}: turn pad spins continuously, keeps horizon level, and releases on cancel`,async()=>{
  const t=setup(path);await t.element('start').onclick();t.qa.state.player.invulnerable=100;
  t.element('joystick').emit('pointerdown',{pointerId:1,clientX:50,clientY:20});
  t.element('turnPad').emit('pointerdown',{pointerId:2,clientX:100,clientY:50});
  t.element('attack').emit('pointerdown',{pointerId:3});
  for(let i=0;i<65;i++)t.frame();
  assert(t.qa.yaw>Math.PI*2,'hold turns through a complete circle without repeated swipes');
  assert.equal(t.qa.pitch,.4);assert.equal(t.qa.input.attack,true);
  assert(Math.hypot(t.qa.input.x,t.qa.input.z)>.5,'movement stays active while turning and attacking');
  t.element('turnPad').emit('pointercancel',{pointerId:2});
  const yaw=t.qa.yaw;t.frame();assert.equal(t.qa.yaw,yaw);
  t.element('turnPad').emit('pointerdown',{pointerId:4,clientX:0,clientY:50});t.frame();assert(t.qa.yaw<yaw);
  t.element('pause').onclick();t.element('resume').onclick();
  const resumed=t.qa.yaw;t.frame();assert.equal(t.qa.yaw,resumed);assert.equal(t.qa.input.attack,false);
 });
 test(`${path}: touch aiming ignores vertical travel and extra fingers`,async()=>{
  const t=setup(path);await t.element('start').onclick();const c=t.element('arenaCanvas');
  c.emit('pointerdown',{pointerId:1,pointerType:'touch',clientX:250,clientY:200});
  c.emit('pointerdown',{pointerId:2,pointerType:'touch',clientX:300,clientY:200});
  c.emit('pointermove',{pointerId:2,pointerType:'touch',clientX:350,clientY:450});assert.equal(t.qa.yaw,0);
  c.emit('pointermove',{pointerId:1,pointerType:'touch',clientX:250,clientY:450});assert.equal(t.qa.pitch,.4);assert.equal(t.qa.yaw,0);
  c.emit('pointermove',{pointerId:1,pointerType:'touch',clientX:350,clientY:450});assert.equal(t.qa.yaw,1);
  c.emit('pointerup',{pointerId:1,pointerType:'touch'});
  c.emit('pointermove',{pointerId:1,pointerType:'touch',clientX:390,clientY:500});assert.equal(t.qa.yaw,1);
 });
 test(`${path}: combat consumes page gestures but pause menus remain scrollable`,async()=>{
  const t=setup(path);await t.element('start').onclick();let prevented=0;
  t.element('arena').emit('touchmove',{cancelable:true,preventDefault(){prevented++;}});assert.equal(prevented,1);
  t.element('pause').onclick();t.element('arena').emit('touchmove',{cancelable:true,preventDefault(){prevented++;}});assert.equal(prevented,1);
 });

}
