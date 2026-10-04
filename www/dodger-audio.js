/* Original procedural effects. No downloaded tracks or audio assets. */
(()=>{
 'use strict';
 let context,master,noiseBuffer,tires=null,previousSessionType=null;
 const sources=new Set(),enabled=()=>Arcade.soundEnabled();
 function session(active){try{const s=navigator.audioSession;if(!s)return;if(active){if(previousSessionType===null)previousSessionType=s.type;s.type='playback';}else if(previousSessionType!==null){s.type=previousSessionType;previousSessionType=null;}}catch{}}
 function track(source,nodes=[]){sources.add(source);source.onended=()=>{sources.delete(source);source.disconnect();for(const n of nodes)n.disconnect();};}
 async function unlock(){
  if(!enabled())return false;
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;session(true);
   if(!context){context=new Audio();master=context.createGain();master.gain.value=.45;master.connect(context.destination);noiseBuffer=context.createBuffer(1,context.sampleRate,context.sampleRate);const samples=noiseBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;}
   const silent=context.createBufferSource();silent.buffer=context.createBuffer(1,1,context.sampleRate);silent.connect(master);track(silent);silent.start();
   if(context.state!=='running')await context.resume();return true;
  }catch{session(false);return false;}
 }
 const ready=()=>enabled()&&context?.state==='running';
 function tone(from,to,duration,volume,delay=0,type='triangle'){
  if(!ready()||sources.size>24)return;
  const t=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();osc.type=type;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+duration);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(master);track(osc,[gain]);osc.start(t);osc.stop(t+duration+.02);
 }
 function burst(duration,volume,from,to){
  if(!ready()||sources.size>24)return;
  const t=context.currentTime,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=noiseBuffer;filter.type='bandpass';filter.Q.value=.7;filter.frequency.setValueAtTime(from,t);filter.frequency.exponentialRampToValueAtTime(to,t+duration);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter);filter.connect(gain);gain.connect(master);track(source,[filter,gain]);source.start(t);source.stop(t+duration+.02);
 }
 function effect(kind,combo=1){
  if(!ready())return;
  if(kind==='start'){tone(110,330,.35,.18);tone(440,880,.22,.13,.15);}
  else if(kind==='near'){burst(.24,.28,2400,300);tone(620+combo*80,930+combo*100,.18,.16,.04);}
  else if(kind==='crash'){burst(.35,.55,1500,100);tone(140,38,.35,.3,0,'sine');}
  else if(kind==='stage'){[392,523,784].forEach((f,i)=>tone(f,f,.2,.13,i*.09));}
  else if(kind==='complete'){[523,659,784,1047].forEach((f,i)=>tone(f,f,.35,.14,i*.11));}
  else if(kind==='end'){tone(240,65,.4,.16);}
 }
 function drive(intensity){
  if(!ready())return;
  const value=Math.max(0,Math.min(1,Number(intensity)||0));
  if(!tires&&value>.01){const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=noiseBuffer;source.loop=true;filter.type='bandpass';filter.Q.value=1.2;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(master);track(source,[filter,gain]);source.start();tires={source,filter,gain};}
  if(tires){const t=context.currentTime;tires.gain.gain.setTargetAtTime(value*.2,t,.045);tires.filter.frequency.setTargetAtTime(650+value*1700,t,.08);}
 }
 function stop(){for(const source of sources){try{source.stop();}catch{}}sources.clear();tires=null;}
 function suspend(){stop();session(false);if(context?.state==='running')Promise.resolve(context.suspend()).catch(()=>{});}
 window.DodgerAudio={unlock,effect,drive,stop,suspend};
})();
