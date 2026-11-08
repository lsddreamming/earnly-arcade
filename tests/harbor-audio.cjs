const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
(async()=>{
const gains=[],sources=[];
const param=()=>({value:0,setTargetAtTime(v){this.value=v;}});
const ctx={currentTime:0,destination:{},decodeAudioData:async b=>{assert.ok(b.byteLength>1000);return {};},createGain(){const n={gain:param(),connect(){return this;}};gains.push(n);return n;},createBufferSource(){const n={playbackRate:param(),connect(){return this;},start(){this.started=true;},stop(){this.stopped=true;this.onended?.();},disconnect(){}};sources.push(n);return n;}};
const sandbox={window:{},Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary')};vm.runInNewContext(fs.readFileSync('harbor-audio.js','utf8'),sandbox);
const api=sandbox.window.HarborAudio;api.start(ctx);await new Promise(r=>setImmediate(r));assert.equal(api.ready(),true);assert.equal(sources.length,3);
api.update({enabled:true,driving:true,speed:12,braking:true,trafficVolume:.5,trafficSpeed:8});assert.ok(gains[0].gain.value>0);assert.ok(gains[1].gain.value>0);assert.ok(gains[3].gain.value>0);assert.ok(sources[0].playbackRate.value>1);
assert.equal(api.play('shot'),true);assert.equal(api.play('voice'),true);assert.equal(api.play('voice'),false);
api.update({enabled:false,driving:false,speed:0,braking:false,trafficVolume:0,trafficSpeed:0});assert.equal(gains[0].gain.value,0);assert.ok(sources.slice(3).every(s=>s.stopped));assert.equal(api.play('shot'),false);
api.update({enabled:true,driving:false,speed:0,braking:false,trafficVolume:0,trafficSpeed:0});assert.equal(api.play('shot'),true);for(let i=0;i<20;i++)api.play('shot');assert.ok(sources.filter(s=>!s.stopped&&!s.loop).length<=8);
console.log('Recorded audio: decode, engine pitch, traffic/skid mix, voice cooldown, mute/pause stop, resume and voice limit passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
