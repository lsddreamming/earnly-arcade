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
  let audio=null,lastSound=-Infinity,noise=null;
  function unlock(){try{if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio=new Audio();noise=audio.createBuffer(1,Math.ceil(audio.sampleRate*.12),audio.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{audio=null;}}
  function sound(hit){if(!audio||audio.state!=='running'||audio.currentTime-lastSound<.075)return;lastSound=audio.currentTime;const t=lastSound;
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=noise;filter.type='bandpass';filter.frequency.setValueAtTime(4200,t);filter.frequency.exponentialRampToValueAtTime(900,t+.11);filter.Q.value=.8;gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(hit?.11:.045,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+.12);source.connect(filter).connect(gain).connect(audio.destination);source.start(t);source.stop(t+.12);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    if(hit){const ring=audio.createOscillator(),volume=audio.createGain();ring.type='triangle';ring.frequency.setValueAtTime(1900,t);ring.frequency.exponentialRampToValueAtTime(850,t+.08);volume.gain.setValueAtTime(.035,t);volume.gain.exponentialRampToValueAtTime(.0001,t+.1);ring.connect(volume).connect(audio.destination);ring.start(t);ring.stop(t+.1);ring.onended=()=>{ring.disconnect();volume.disconnect();};}}
  window.NeonSlicePresentation={background,spatula,unlock,sound};
})();
