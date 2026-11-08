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
vm.runInNewContext(src.replace('  requestAnimationFrame(frame);\n})();', `  globalThis.pose = (x,z,a) => { Object.assign(player,{x,z,angle:a}); Object.assign(camera,{x,z,angle:a,distance:9.6}); footView=a; }; globalThis.setEnergy = n => stamina=n; globalThis.inspect = () => ({blocks, lamps, displacedDrivers, stamina,exhausted,stats:{...stats},walkCycle, footSpeed, actualFootSpeed, car: {...car}, player: {...player}, patrol: {...patrol}, phase, lost, inCar, elapsed, visible, route, garage, blocked, camera: {...camera}, eye: {...eye}, stageIndex, heatLevel, activeJob, records, vehicles, jobs, size, workers, traffic: traffic.map(v => ({...v})) }); globalThis.setPlayer = (x,z) => Object.assign(player,{x,z}); globalThis.setCar = (x,z,angle,speed) => { inCar=stolen=true; Object.assign(car,{x,z,angle,speed}); }; globalThis.testStep = (step) => { if (step.kind === 'escape') { heatLevel = 0; lost = true; } else if (step.kind === 'shoot') { inCar = false; player.x = step.x; player.z = step.z + 2; shotFlash = 0; } else { inCar = stolen = true; Object.assign(car,{x:step.x,z:step.z,speed:0}); } };\n  requestAnimationFrame(frame);\n})();`), sandbox);
let now = 1000;
function tick(frames) { for (let i = 0; i < frames; i++) frame(now += 1000/60); }
const click = id => get(id).handlers.click();
const key = (code, down) => doc.handlers[down ? 'keydown' : 'keyup']({code, preventDefault(){}});
function hold(code, frames) { key(code,true); tick(frames); key(code,false); }

let passes=0;
function pass(name,fn) { fn(); console.log(`${++passes}/25 ${name}`); }
function fresh(){click('free-roam');sandbox.pose(124,124,0);}
tick(1);
const directions=[['ArrowUp'],['ArrowUp','ArrowRight'],['ArrowRight'],['ArrowDown','ArrowRight'],['ArrowDown'],['ArrowDown','ArrowLeft'],['ArrowLeft'],['ArrowUp','ArrowLeft']];
for(let d=0;d<8;d++) pass('Movement direction '+d,()=>{fresh();for(const k of directions[d])key(k,true);let previous=sandbox.inspect().player;for(let i=0;i<80;i++){tick(1);const p=sandbox.inspect().player;assert.ok((p.x-previous.x)*Math.sin(p.angle)-(p.z-previous.z)*Math.cos(p.angle)>=-1e-7);previous=p;}for(const k of directions[d])key(k,false);const stopped=sandbox.inspect().player;tick(5);assert.deepEqual(sandbox.inspect().player,stopped);});
for(let d=0;d<8;d++) pass('Wall camera angle '+d,()=>{fresh();const b=sandbox.inspect().blocks[0];const a=d*Math.PI/4;const x=b.x+b.w/2+Math.sin(a)*(b.w/2+1.5),z=b.z+b.d/2-Math.cos(a)*(b.d/2+1.5);sandbox.pose(x,z,a);tick(60);const c=sandbox.inspect().camera;const ex=c.x-Math.sin(c.angle)*c.distance,ez=c.z+Math.cos(c.angle)*c.distance;assert.ok(Number.isFinite(c.distance)&&c.distance>0);assert.ok(!sandbox.inspect().blocks.some(b=>ex>b.x&&ex<b.x+b.w&&ez>b.z&&ez<b.z+b.d));});
pass('Sprint acceleration',()=>{fresh();sandbox.pose(12,26,0);click('run-mode');hold('ArrowUp',30);assert.ok(sandbox.inspect().actualFootSpeed>8);});
pass('Stamina exhaustion and recovery',()=>{fresh();sandbox.pose(12,26,0);click('run-mode');sandbox.setEnergy(.1);hold('ArrowUp',20);assert.ok(sandbox.inspect().exhausted);tick(180);assert.ok(!sandbox.inspect().exhausted);});
pass('Saved movement profile',()=>{get('stat-build').value=40;get('stat-build').handlers.input();assert.equal(JSON.parse(saved.get('harborFitnessV1')).build,.4);get('stat-build').value=0;get('stat-build').handlers.input();});
pass('Keyboard settings isolation',()=>{fresh();doc.handlers.keydown({code:'ArrowUp',target:{closest:()=>true},preventDefault(){}});const p=sandbox.inspect().player;tick(10);assert.deepEqual(sandbox.inspect().player,p);});
pass('Parking and traffic clearance',()=>{fresh();const initial=sandbox.inspect().traffic;sandbox.pose(110,110,0);tick(180);assert.ok(sandbox.inspect().traffic.every((v,i)=>Math.hypot(v.x-initial[i].x,v.z-initial[i].z)>2));});
pass('Traffic takeover and reentry',()=>{fresh();const v=sandbox.inspect().traffic[0];sandbox.setPlayer(v.x+2,v.z);tick(1);click('interact');assert.ok(sandbox.inspect().inCar);assert.equal(sandbox.inspect().displacedDrivers.length,1);click('interact');click('interact');assert.ok(sandbox.inspect().inCar);assert.equal(sandbox.inspect().displacedDrivers.length,1);});
pass('Streetlight destruction and reset',()=>{fresh();const l=sandbox.inspect().lamps[0];sandbox.setCar(l.x-1.2,l.z+2.4,0,12);tick(15);assert.notEqual(sandbox.inspect().lamps[0].brokenAt,null);fresh();assert.equal(sandbox.inspect().lamps[0].brokenAt,null);});
pass('Pedestrian population and pause',()=>{fresh();assert.equal(sandbox.inspect().workers.length,48);click('pause');const p=sandbox.inspect().workers.map(w=>[w.x,w.z]);tick(30);assert.deepEqual(sandbox.inspect().workers.map(w=>[w.x,w.z]),p);});
pass('All mission stage chains',()=>{for(let i=0;i<12;i++){click('free-roam');get('mission').value=i;const state=sandbox.inspect();for(const job of state.jobs)state.records[job.name]=100;get('mission').value=i;click('start');const job=sandbox.inspect().activeJob;assert.ok(job);for(const stage of job.stages){sandbox.testStep(stage);if(stage.kind==='shoot')click('fire');else tick(1);}assert.equal(sandbox.inspect().stageIndex,job.stages.length);}});
assert.equal(passes,25);
