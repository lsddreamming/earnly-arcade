/* Local, gesture-unlocked Web Audio. No microphone, network voice service, or speech queue. */
(()=>{
  'use strict';
  let context, master, voiceBuffer, voiceSource, lastVoice=-Infinity, previousSessionType=null;
  const sources=new Set();
  const enabled=()=>typeof Arcade==='undefined'||Arcade.soundEnabled();
  const voicesEnabled=()=>localStorage.getItem('neonBreachVoice')!=='off';
  function playbackSession(active){
    // iOS otherwise routes Web Audio through the ringer's ambient channel.
    // https://bugs.webkit.org/show_bug.cgi?id=237322
    try{
      const session=navigator.audioSession;if(!session)return;
      if(active){if(previousSessionType===null)previousSessionType=session.type;session.type='playback'}
      else if(previousSessionType!==null){session.type=previousSessionType;previousSessionType=null}
    }catch{}
  }
  function unlock(){
    if(!enabled())return;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return;
      playbackSession(true);
      if(!context){context=new Audio();master=context.createGain();master.gain.value=.58;master.connect(context.destination)}
      if(context.state!=='running')Promise.resolve(context.resume()).catch(()=>{});
      // A source started inside the gesture also unlocks older iPhone WebKit.
      const source=context.createBufferSource();source.buffer=context.createBuffer(1,1,context.sampleRate);source.connect(master);source.start();
    }catch{playbackSession(false)}
  }
  function ready(){return enabled()&&context?.state==='running'}
  function track(source,nodes=[]){
    sources.add(source);
    source.onended=()=>{sources.delete(source);source.disconnect();nodes.forEach(node=>node.disconnect());if(source===voiceSource)voiceSource=null};
  }
  function tone(from,to,duration,volume,type='sine',delay=0){
    if(!ready())return;
    const t=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();
    osc.type=type;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+duration);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain);gain.connect(master);track(osc,[gain]);osc.start(t);osc.stop(t+duration+.01);
  }
  function noise(duration,volume,frequency){
    if(!ready())return;
    const b=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=b.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
    const source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter();
    source.buffer=b;filter.type='bandpass';filter.frequency.value=frequency;gain.gain.value=volume;
    source.connect(filter);filter.connect(gain);gain.connect(master);track(source,[filter,gain]);source.start();
  }
  function effect(kind,rapid=false){
    if(!ready())return;
    if(kind==='fire'){tone(rapid?1800:1450,160,.16,.11,'sawtooth');tone(2400,430,.1,.10);noise(.035,.12,3500)}
    else if(kind==='hit'){tone(760,190,.08,.075,'square');noise(.06,.2,1700)}
    else if(kind==='kill'){tone(240,42,.22,.15,'triangle');noise(.24,.35,950);tone(1250,430,.12,.07,'sine',.025)}
    else if(kind==='damage'){tone(160,70,.19,.15,'triangle');noise(.09,.19,550)}
    else if(kind==='shield'){tone(420,1100,.22,.12);tone(650,1600,.25,.05)}
    else if(kind==='pickup'){[550,820,1100].forEach((f,i)=>tone(f,f,.15,.10,'sine',i*.07))}
    else if(kind==='wave'){tone(180,360,.3,.08,'triangle');tone(540,1080,.2,.055,'sine',.15)}
  }
  function voice(id,force=false){
    const bank=window.NeonBreachVoices,clip=bank?.clips[id];
    if(!ready()||!voicesEnabled()||!clip||voiceSource||(!force&&context.currentTime-lastVoice<7))return false;
    if(!voiceBuffer){
      const pcm=atob(bank.pcm);voiceBuffer=context.createBuffer(1,pcm.length,bank.rate);
      const samples=voiceBuffer.getChannelData(0);for(let i=0;i<pcm.length;i++)samples[i]=(pcm.charCodeAt(i)-128)/128;
    }
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=voiceBuffer;gain.gain.value=.85;
    source.connect(gain);gain.connect(master);track(source,[gain]);voiceSource=source;lastVoice=context.currentTime;
    source.start(0,clip.start/bank.rate,clip.length/bank.rate);return true;
  }
  function stop(){for(const source of sources){try{source.stop()}catch{}}sources.clear();voiceSource=null}
  function suspend(){stop();playbackSession(false);if(context?.state==='running')Promise.resolve(context.suspend()).catch(()=>{})}
  function reset(){stop();lastVoice=-Infinity}
  window.NeonBreachAudio={unlock,effect,voice,stop,suspend,reset,voicesEnabled};
})();
