/* Original cookout scenery, utensil artwork and synthesized slicing audio. */
(() => {
  'use strict';
  // Bake scenery once: no gradients or shadows in the animation loop.
  const backdrop=document.createElement('canvas');backdrop.width=720;backdrop.height=1080;
  const c=backdrop.getContext('2d');c.scale(2,2);
  const sky=c.createLinearGradient(0,0,360,540);sky.addColorStop(0,'#192446');sky.addColorStop(.5,'#101b32');sky.addColorStop(1,'#233349');c.fillStyle=sky;c.fillRect(0,0,360,540);
  for(const [x,y,color] of [[0,180,'#35dcd52b'],[360,280,'#e477c52b']]){const g=c.createRadialGradient(x,y,0,x,y,240);g.addColorStop(0,color);g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(0,0,360,540);}
  // Recessed tiles, a neon canopy and a brushed steel counter.
  c.strokeStyle='#8ba6d00c';c.lineWidth=1;
  for(let y=100;y<510;y+=32)for(let x=(y/32%2)*24-48;x<360;x+=48)c.strokeRect(x,y,48,32);
  c.strokeStyle='#71e8ec';c.shadowColor='#37e5df';c.shadowBlur=12;c.lineWidth=2;c.beginPath();c.moveTo(15,84);c.lineTo(15,24);c.lineTo(345,24);c.lineTo(345,84);c.stroke();c.shadowBlur=0;
  c.textAlign='center';c.fillStyle='#e4faff';c.font='800 17px system-ui';c.fillText('N I G H T  M A R K E T',180,53);
  c.fillStyle='#ffca8c';c.font='600 8px system-ui';c.fillText('F R E S H  C U T S  •  B I G  C O M B O S',180,71);
  c.strokeStyle='#334b66';c.beginPath();c.moveTo(0,88);c.quadraticCurveTo(180,130,360,88);c.stroke();
  for(let x=12;x<360;x+=28){const y=88+42*(x/360)*(1-x/360);c.fillStyle='#ffd6a4';c.shadowColor='#ffbf6c';c.shadowBlur=8;c.beginPath();c.arc(x,y,2,0,7);c.fill();}c.shadowBlur=0;
  const counter=c.createLinearGradient(0,506,0,540);counter.addColorStop(0,'#446179');counter.addColorStop(.12,'#20374b');counter.addColorStop(1,'#0c1729');c.fillStyle=counter;c.fillRect(0,506,360,34);
  c.fillStyle='#7fe9e8';c.fillRect(0,506,360,1);c.fillStyle='#90b4d21a';for(let x=-30;x<390;x+=24)c.fillRect(x,518,14,2);
  function background(ctx){ctx.drawImage(backdrop,0,0,360,540);}
  function spatula(ctx,p,angle){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.scale(.7,.7);
    const steel=ctx.createLinearGradient(0,-9,0,9);steel.addColorStop(0,'#f4ffff');steel.addColorStop(.4,'#b7e7f4');steel.addColorStop(1,'#5085a0');ctx.fillStyle=steel;
    ctx.beginPath();ctx.moveTo(-8,-6);ctx.lineTo(27,-6);ctx.quadraticCurveTo(18,10,-8,7);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#ecffff';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#213d5b';ctx.beginPath();ctx.roundRect(-29,-5,22,10,4);ctx.fill();ctx.fillStyle='#71e8ec';ctx.fillRect(-11,-6,3,12);ctx.fillStyle='#b8d8e8';for(const x of [-23,-16]){ctx.beginPath();ctx.arc(x,0,1.4,0,7);ctx.fill();}ctx.restore();}
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
  // A short service-bell chord rewards a completed swipe, not every hit.
  function combo(hits){
    if(!audio||audio.state!=='running')return;
    const t=audio.currentTime,base=hits>=5?880:660;
    for(const [ratio,offset] of [[1,0],[1.25,.055],[1.5,.11]]){
      const tone=audio.createOscillator(),gain=audio.createGain();
      tone.type='sine';tone.frequency.value=base*ratio;
      gain.gain.setValueAtTime(.0001,t+offset);
      gain.gain.exponentialRampToValueAtTime(.035,t+offset+.008);
      gain.gain.exponentialRampToValueAtTime(.0001,t+offset+.24);
      tone.connect(gain).connect(audio.destination);tone.start(t+offset);tone.stop(t+offset+.25);
      tone.onended=()=>{tone.disconnect();gain.disconnect();};
    }
  }
  window.NeonSlicePresentation={background,spatula,unlock,sound,warning,combo};
})();
