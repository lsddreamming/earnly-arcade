/* Original cookout scenery, utensil artwork and synthesized slicing audio. */
(() => {
  'use strict';
  const backdrop=document.createElement('canvas');backdrop.width=720;backdrop.height=1080;
  const c=backdrop.getContext('2d');c.scale(2,2);
  const sky=c.createLinearGradient(0,0,0,540);sky.addColorStop(0,'#19363e');sky.addColorStop(.48,'#11272d');sky.addColorStop(1,'#292422');c.fillStyle=sky;c.fillRect(0,0,360,540);
  // A quiet dusk patio keeps moving ingredients legible.
  c.fillStyle='#10232a';for(let x=0;x<360;x+=40){c.fillRect(x,120,37,360);c.fillStyle='#203a3d';c.fillRect(x,120,1,360);c.fillStyle='#10232a';}
  c.strokeStyle='#496060';c.lineWidth=2;c.beginPath();c.moveTo(0,16);c.quadraticCurveTo(180,70,360,16);c.stroke();
  for(let x=18;x<360;x+=36){const y=16+54*(x/360)*(1-x/360);const glow=c.createRadialGradient(x,y+6,1,x,y+6,17);glow.addColorStop(0,'#ffd79255');glow.addColorStop(1,'#ffd79200');c.fillStyle=glow;c.fillRect(x-17,y-11,34,34);c.fillStyle='#fbd394';c.beginPath();c.ellipse(x,y+6,3,4,0,0,7);c.fill();}
  c.fillStyle='#d7bd88';c.globalAlpha=.55;c.font='700 10px system-ui';c.textAlign='center';c.fillText('E A R N L Y   C O O K O U T',180,72);c.globalAlpha=1;
  const heat=c.createRadialGradient(180,570,5,180,540,190);heat.addColorStop(0,'#e783353d');heat.addColorStop(1,'#e7833500');c.fillStyle=heat;c.fillRect(0,350,360,190);
  c.fillStyle='#121c21';c.fillRect(0,506,360,34);c.strokeStyle='#405052';c.lineWidth=3;for(let x=-60;x<420;x+=18){c.beginPath();c.moveTo(x,540);c.lineTo(x+36,506);c.stroke();}c.fillStyle='#65716b';c.fillRect(0,504,360,3);
  function background(ctx){ctx.drawImage(backdrop,0,0,360,540);}
  function spatula(ctx,p,angle){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle+Math.PI/2);ctx.scale(.75,.75);ctx.lineJoin='round';
    ctx.fillStyle='#a65b35';ctx.strokeStyle='#422d26';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-5,10,10,28,4);ctx.fill();ctx.stroke();
    ctx.fillStyle='#c0d7d7';ctx.fillRect(-2,-4,4,18);const metal=ctx.createLinearGradient(-12,0,12,0);metal.addColorStop(0,'#789baf');metal.addColorStop(.45,'#f0ffff');metal.addColorStop(1,'#8faebc');ctx.fillStyle=metal;ctx.beginPath();ctx.roundRect(-12,-27,24,27,5);ctx.fill();ctx.strokeStyle='#edfcff';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#24404a';for(let x=-7;x<=7;x+=7){ctx.beginPath();ctx.roundRect(x-1.5,-21,3,15,1.5);ctx.fill();}ctx.restore();}
  let audio=null,lastSwipe=-Infinity,lastHit=-Infinity,noise=null,voice=0;
  function unlock(){try{if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio=new Audio();noise=audio.createBuffer(1,Math.ceil(audio.sampleRate*.18),audio.sampleRate);const data=noise.getChannelData(0);let seed=173;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}}if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{audio=null;}}
  function sound(hit){
    if(!audio||audio.state!=='running')return;
    const t=audio.currentTime;
    // Give contact its own cooldown so a preceding air swipe cannot swallow it.
    if(hit){if(t-lastHit<.085)return;lastHit=t;}else{if(t-Math.max(lastSwipe,lastHit)<.14)return;lastSwipe=t;}
    const pitch=[1,1.06,.97,1.03][voice++%4];
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
    source.buffer=noise;filter.type='bandpass';filter.Q.value=1.8;
    filter.frequency.setValueAtTime(1600*pitch,t);filter.frequency.exponentialRampToValueAtTime(7200*pitch,t+.025);filter.frequency.exponentialRampToValueAtTime(2100*pitch,t+.16);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(hit?.065:.04,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+.17);
    source.connect(filter).connect(gain).connect(audio.destination);source.start(t);source.stop(t+.18);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    // Inharmonic steel resonances: a bright blade "shing", not a pitched beep.
    const partials=hit?[[2300,.038,.22],[3670,.018,.15],[5910,.009,.09]]:[[3100,.014,.16],[4960,.006,.10]];
    for(const [frequency,level,decay] of partials){
      const ring=audio.createOscillator(),volume=audio.createGain();ring.type='sine';
      ring.frequency.setValueAtTime(frequency*pitch*1.12,t);ring.frequency.exponentialRampToValueAtTime(frequency*pitch,t+.035);
      volume.gain.setValueAtTime(.0001,t);volume.gain.exponentialRampToValueAtTime(level,t+.003);volume.gain.exponentialRampToValueAtTime(.0001,t+decay);
      ring.connect(volume).connect(audio.destination);ring.start(t);ring.stop(t+decay);
      ring.onended=()=>{ring.disconnect();volume.disconnect();};
    }
  }
  let lastWarning=-Infinity;
  function warning(){
    if(!audio||audio.state!=='running'||audio.currentTime-lastWarning<.8)return;
    const t=lastWarning=audio.currentTime;
    // A brief low double tick stands apart from the high steel slicing sound.
    for(const offset of [0,.11]){const tone=audio.createOscillator(),gain=audio.createGain();tone.type='triangle';tone.frequency.setValueAtTime(440,t+offset);tone.frequency.exponentialRampToValueAtTime(220,t+offset+.065);gain.gain.setValueAtTime(.0001,t+offset);gain.gain.exponentialRampToValueAtTime(.045,t+offset+.005);gain.gain.exponentialRampToValueAtTime(.0001,t+offset+.075);tone.connect(gain).connect(audio.destination);tone.start(t+offset);tone.stop(t+offset+.08);tone.onended=()=>{tone.disconnect();gain.disconnect();};}
  }
  window.NeonSlicePresentation={background,spatula,unlock,sound,warning};
})();
