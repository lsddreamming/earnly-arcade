const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const make = () => ({
  style: {}, handlers: {}, setAttribute() {}, children: [], append(node) { this.children.push(node); }, replaceChildren() { this.children = []; }, classList: { toggle() {} }, addEventListener(key, fn) { this.handlers[key] = fn; },
  getBoundingClientRect: () => ({ width: 390, height: 480 }),
  focus() {}, setPointerCapture() {},
});
const elements = new Map();
const get = id => {
  if (!elements.has(id)) elements.set(id, make());
  return elements.get(id);
};
let painted = 0; let faded = 0;
const context = new Proxy({createLinearGradient: () => ({addColorStop(){}}), createRadialGradient: () => ({addColorStop(){}}), fill(){painted++; if(this.globalAlpha===0.12) faded++;}, moveTo(x,y){assert.ok(Number.isFinite(x) && Number.isFinite(y));}, lineTo(x,y){assert.ok(Number.isFinite(x) && Number.isFinite(y));}}, {
  get(target, key) { return target[key] ?? (() => {}); },
});
get('city').getContext = () => context;
const buttons = ['up','left','down','right'].map(key => Object.assign(make(), { dataset: { key } }));
const doc = Object.assign(make(), {getElementById: get, createElement: make, querySelectorAll: () => buttons});
let frame;
const saved = new Map();
const gains=[];
class AudioContext {
  constructor() { this.currentTime=0; this.state='running'; this.destination={}; }
  createOscillator() {return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}},connect(node){return node},start(){},stop(){},disconnect(){}}}
  createGain() {const g={value:0,setTargetAtTime(value){this.value=value},setValueAtTime(){},exponentialRampToValueAtTime(){}}; gains.push(g);return {gain:g,connect(node){return node},disconnect(){}}}
}
const sandbox = { document: doc, window: {...make(), AudioContext, localStorage: { getItem: key => saved.get(key), setItem: (key,value) => saved.set(key,value) }}, requestAnimationFrame(fn) { frame = fn; } };
const src = fs.readFileSync(require('node:path').join(__dirname,'../harbor-getaway.js'), 'utf8').replace('    render();', '    if (Math.round(time / 16.6667) % 30 === 1 || time < 1020) render();');
vm.runInNewContext(src.replace('  requestAnimationFrame(frame);\n})();', `  globalThis.roofTest = (v,y,velocity=0) => { roofSupport=null; inCar=false; jumpHeight=y; jumpVelocity=velocity; Object.assign(player,{x:v.x,z:v.z,angle:v.angle}); }; globalThis.pose = (x,z,a) => { Object.assign(player,{x,z,angle:a}); Object.assign(camera,{x,z,angle:a,distance:9.6}); footView=a; }; globalThis.setEnergy = n => stamina=n; globalThis.inspect = () => ({roofSupport,jumpHeight,jumpVelocity,blocks, lamps, displacedDrivers, stamina,exhausted,stats:{...stats},walkCycle, footSpeed, actualFootSpeed, car: {...car}, player: {...player}, patrol: {...patrol}, phase, lost, inCar, elapsed, visible, route, garage, blocked, camera: {...camera}, eye: {...eye}, stageIndex, heatLevel, activeJob, records, vehicles, jobs, size, workers, traffic: traffic.map(v => ({...v})) }); globalThis.setPlayer = (x,z) => Object.assign(player,{x,z}); globalThis.setCar = (x,z,angle,speed) => { inCar=stolen=true; Object.assign(car,{x,z,angle,speed}); }; globalThis.testStep = (step) => { if (step.kind === 'escape') { heatLevel = 0; lost = true; } else if (step.kind === 'shoot') { inCar = false; player.x = step.x; player.z = step.z + 2; shotFlash = 0; } else { inCar = stolen = true; Object.assign(car,{x:step.x,z:step.z,speed:0}); } };\n  requestAnimationFrame(frame);\n})();`), sandbox);
let now = 1000;
function tick(frames) { for (let i = 0; i < frames; i++) frame(now += 1000/60); }
const click = id => get(id).handlers.click();
const key = (code, down) => doc.handlers[down ? 'keydown' : 'keyup']({code, preventDefault(){}});
function hold(code, frames) { key(code,true); tick(frames); key(code,false); }


function fresh(){click('free-roam');sandbox.pose(124,124,0);tick(1);}
function tap(time,x=100,y=100){const t={identifier:1,clientX:x,clientY:y};get('city').handlers.touchstart({timeStamp:time,touches:[t],changedTouches:[t],preventDefault(){}});doc.handlers.touchend({type:'touchend',timeStamp:time+50,touches:[],changedTouches:[t]});}
fresh();click('jump');tick(10);assert.ok(sandbox.inspect().jumpHeight>0);const rising=sandbox.inspect().jumpVelocity;click('jump');assert.equal(sandbox.inspect().jumpVelocity,rising);tick(80);assert.equal(sandbox.inspect().jumpHeight,0);
fresh();tap(1000);assert.equal(sandbox.inspect().jumpVelocity,0);tap(1200);assert.equal(sandbox.inspect().jumpVelocity,9.4);tick(10);click('pause');const height=sandbox.inspect().jumpHeight;tick(20);assert.equal(sandbox.inspect().jumpHeight,height);click('pause');tick(80);assert.equal(sandbox.inspect().jumpHeight,0);
fresh();tap(2000);tap(2500);assert.equal(sandbox.inspect().jumpVelocity,0);
fresh();tap(3000);tap(3200,200);assert.equal(sandbox.inspect().jumpVelocity,0);
fresh();tap(4000);const t={identifier:2,clientX:100,clientY:100};get('city').handlers.touchstart({timeStamp:4200,touches:[t],changedTouches:[t],preventDefault(){}});get('city').handlers.touchmove({changedTouches:[{...t,clientX:140}],preventDefault(){}});doc.handlers.touchend({type:'touchend',timeStamp:4250,touches:[],changedTouches:[t]});assert.equal(sandbox.inspect().jumpVelocity,0);
fresh();tap(5000);get('city').handlers.touchstart({timeStamp:5200,touches:[t,{...t,identifier:3}],changedTouches:[t],preventDefault(){}});doc.handlers.touchend({type:'touchend',timeStamp:5250,touches:[],changedTouches:[t]});assert.equal(sandbox.inspect().jumpVelocity,0);
fresh();tap(6000);get('city').handlers.touchstart({timeStamp:6200,touches:[t],changedTouches:[t],preventDefault(){}});doc.handlers.touchcancel({type:'touchcancel',timeStamp:6250,touches:[],changedTouches:[t]});assert.equal(sandbox.inspect().jumpVelocity,0);
fresh();key('Space',true);assert.equal(sandbox.inspect().jumpVelocity,9.4);tick(10);click('free-roam');assert.equal(sandbox.inspect().jumpHeight,0);assert.equal(sandbox.inspect().jumpVelocity,0);
fresh();sandbox.setCar(124,124,0,0);click('jump');tap(7000);tap(7200);assert.equal(sandbox.inspect().jumpVelocity,0);
fresh();key('ArrowUp',true);click('jump');const before=sandbox.inspect().player;tick(10);key('ArrowUp',false);assert.ok(sandbox.inspect().jumpHeight>0);assert.ok(Math.hypot(sandbox.inspect().player.x-before.x,sandbox.inspect().player.z-before.z)>0);
console.log('Jump: button, keyboard, double-tap, landing, no air jump, pause/resume, reset, movement, driving exclusion, drag, spacing, multi-touch and cancellation passed');

fresh();let v=sandbox.inspect().vehicles[0];sandbox.roofTest(v,2.3,-1);tick(40);assert.equal(sandbox.inspect().roofSupport?.vehicle,v);assert.ok(sandbox.inspect().jumpHeight>1);click('jump');assert.equal(sandbox.inspect().jumpVelocity,9.4);tick(100);assert.equal(sandbox.inspect().roofSupport?.vehicle,v);v.destroyed=true;tick(80);assert.equal(sandbox.inspect().jumpHeight,0);v.destroyed=false;
fresh();v=sandbox.inspect().vehicles[0];sandbox.roofTest(v,2.3,-1);tick(40);const p=sandbox.inspect().player;v.x+=.3;tick(1);assert.ok(Math.abs(sandbox.inspect().player.x-p.x-.3)<.001);key('ArrowUp',true);tick(100);key('ArrowUp',false);tick(80);assert.equal(sandbox.inspect().jumpHeight,0);
fresh();const finger={identifier:11,clientX:100,clientY:100};get('city').handlers.touchstart({changedTouches:[finger],touches:[finger],preventDefault(){}});get('city').handlers.touchmove({changedTouches:[{...finger,clientY:60}],preventDefault(){}});const pos=sandbox.inspect().player;get('jump').handlers.pointerdown({button:0,preventDefault(){}});tick(10);assert.ok(sandbox.inspect().jumpHeight>0);assert.ok(Math.hypot(sandbox.inspect().player.x-pos.x,sandbox.inspect().player.z-pos.z)>0);doc.handlers.touchend({type:'touchend',changedTouches:[finger],touches:[]});
console.log('Roof landing, roof re-jump, moving support, destroyed support, walk-off and simultaneous run/jump passed');

fresh();const stunned=sandbox.inspect().workers[0];Object.assign(stunned,{health:0,recover:.1,tilt:1.3,elevation:0,lift:0});tick(20);assert.equal(stunned.health,100);assert.equal(stunned.tilt,0);assert.equal(stunned.elevation,0);console.log('Cartoon knockout recovery returns pedestrian upright');
