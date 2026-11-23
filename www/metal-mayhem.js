(()=>{
 'use strict';
 const E=window.MetalMayhem,$=id=>document.getElementById(id),coarse=matchMedia('(pointer:coarse)').matches;
 let state=E.create(17),view,playing=false,paused=false,last=0,accumulator=0,yaw=0,pitch=.4,session=null,saved=false,helpReturn='intro',phase='',startGeneration=0,starting=false;
 let joy={x:0,y:0},look=null,turnId=null,turn=0,joyId=null,keys=new Set(),held={attack:false,block:false,jump:false,dodge:false},buttonIds=new Map(),bannerUntil=0,feedbackUntil=0,hurtUntil=0,hitStopUntil=0,lastFoot=0,ambienceDue=0,slowFrames=0,autoLow=false;
 const screens=['intro','pauseScreen','upgradeScreen','resultScreen','helpScreen','rankScreen','errorScreen'];
 let best={score:0,wave:0};try{const x=JSON.parse(localStorage.getItem('earnly.metalMayhem.best.v1')||'{}');best.score=Math.max(0,Math.min(1e9,Number(x.score)||0));best.wave=Math.max(0,Math.min(1e6,Number(x.wave)||0));}catch{}
 let cameraMode='wide';try{const saved=localStorage.getItem('earnly.metalMayhem.camera');if(['wide','far','close'].includes(saved))cameraMode=saved;}catch{}
 let sound=true;try{sound=localStorage.getItem('earnly.metalMayhem.sound')!=='off';}catch{}
 const audio={ctx:null,voices:0,noise:null,init(){try{this.ctx=this.ctx||new(window.AudioContext||window.webkitAudioContext)();if(sound)this.ctx.resume().catch(()=>{});}catch{}},play(type){
  if(!sound||!this.ctx||this.ctx.state!=='running'||this.voices>15)return;
  const c=this.ctx,now=c.currentTime,settings={step:[90,45,.055,.012],ambient:[48,56,1.8,.006],spark:[1300,180,.08,.015],swing:[230,65,.12,.035],hit:[170,40,.16,.09],sever:[350,35,.28,.08],destroy:[95,24,.45,.12],parry:[1300,580,.27,.07],block:[620,180,.13,.06],wave:[180,520,.45,.06],clear:[400,1100,.6,.05],upgrade:[620,1450,.2,.06],dodge:[130,460,.12,.035],jump:[150,300,.1,.02],shoot:[1000,200,.13,.025],armor:[730,140,.2,.05]};
  const a=settings[type];if(!a)return;this.voices++;
  const o=c.createOscillator(),g=c.createGain();o.type=['hit','sever','destroy','armor'].includes(type)?'sawtooth':'triangle';o.frequency.setValueAtTime(a[0],now);o.frequency.exponentialRampToValueAtTime(a[1],now+a[2]);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(a[3],now+.008);g.gain.exponentialRampToValueAtTime(.0001,now+a[2]);o.connect(g);g.connect(c.destination);o.start();o.stop(now+a[2]+.02);o.onended=()=>{this.voices--;o.disconnect();g.disconnect();};
  if(['hit','sever','destroy','swing'].includes(type)){if(!this.noise){this.noise=c.createBuffer(1,c.sampleRate*.4,c.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);}const n=c.createBufferSource(),ng=c.createGain(),f=c.createBiquadFilter();n.buffer=this.noise;f.type='highpass';f.frequency.value=type==='destroy'?250:2000;ng.gain.setValueAtTime(a[3]*.6,now);ng.gain.exponentialRampToValueAtTime(.0001,now+a[2]);n.connect(f);f.connect(ng);ng.connect(c.destination);n.start();n.stop(now+a[2]);n.onended=()=>{n.disconnect();f.disconnect();ng.disconnect();};}
 }};
 function show(id){for(const name of screens)$(name).hidden=name!==id;const active=playing&&!paused&&state.phase==='combat'&&!id;$('hud').hidden=!playing||id==='intro';$('controls').hidden=!active;$('crosshair').hidden=!active;$('desktopHelp').hidden=!active;if(id&&document.pointerLockElement)document.exitPointerLock?.();}
 function clearInput(){keys.clear();joy={x:0,y:0};joyId=null;look=null;turnId=null;turn=0;$('turnStick').style.transform='';for(const k of Object.keys(held))held[k]=false;for(const k of ['attack','block','jump','dodge'])$(k).classList.remove('pressed');buttonIds.clear();$('stick').style.transform='';}
 function banner(text,sub=''){ $('waveBanner').replaceChildren();$('waveBanner').append(document.createTextNode(text));if(sub){const el=document.createElement('small');el.textContent=sub;$('waveBanner').append(el);}$('waveBanner').classList.add('show');bannerUntil=performance.now()+2100;}
 function feedback(text){$('feedback').textContent=text;feedbackUntil=performance.now()+800;}
 function bestLabel(){$('best').textContent=best.wave?`BEST WAVE ${best.wave} · ${best.score.toLocaleString()}`:'NO RECORD YET';}
 function saveBest(){if(saved)return;saved=true;const record=state.score>best.score||state.wave>best.wave;best.score=Math.max(best.score,state.score);best.wave=Math.max(best.wave,state.wave);try{localStorage.setItem('earnly.metalMayhem.best.v1',JSON.stringify(best));$('resultBest').textContent=record?'NEW PERSONAL RECORD':'Best: wave '+best.wave+' · '+best.score.toLocaleString();}catch{$('resultBest').textContent='Storage unavailable — this record could not be saved.';}bestLabel();}
 async function start(){
  if(starting)return;starting=true;const generation=++startGeneration;clearInput();audio.init();$('start').disabled=true;$('start').textContent='Entering arena…';
  session?.flush(true).catch(()=>{});session=null;
  // Playing never waits on auth or the backend. A ticket must arrive before simulation starts.
  let ticket=null;try{ticket=await Promise.race([window.MetalMayhemRewards?.start(),new Promise(resolve=>setTimeout(()=>resolve(null),1400))]);}catch{}
  if(generation!==startGeneration){starting=false;return;}
  state=E.create(ticket?.seed||crypto.getRandomValues(new Uint32Array(1))[0]);session=window.MetalMayhemRewards?.createSession(ticket)||null;
  playing=true;paused=false;saved=false;phase='';yaw=0;pitch=.4;accumulator=0;last=performance.now();view.reset();show(null);banner('WAVE 01',view.venueName?.(1) || 'The Crucible');audio.play('wave');
  $('rewardNote').textContent=ticket?'Verified run · rewards confirmed by Earnly':'Practice play · personal records saved on this device.';$('start').textContent='Enter the arena →';$('start').disabled=false;starting=false;
  // A ticket can finish loading after the player has switched away.
  if(document.hidden)pause();
 }
 function pause(){if(!playing||state.phase==='dead'||paused)return;paused=true;clearInput();accumulator=0;show('pauseScreen');audio.ctx?.suspend().catch(()=>{});}
 function resume(){if(!playing||document.hidden)return;paused=false;clearInput();last=performance.now();accumulator=0;audio.init();if(state.phase==='upgrade'){show('upgradeScreen');}else show(null);}
 function upgrades(){clearInput();show('upgradeScreen');$('clearLabel').textContent=`WAVE ${String(state.wave).padStart(2,'0')} COMPLETE · ${state.score.toLocaleString()} POINTS`;$('upgradeChoices').replaceChildren();
  for(const id of state.choices){const u=E.UPGRADES.find(x=>x.id===id),b=document.createElement('button');b.className='upgrade-card';b.dataset.upgrade=id;const icon=document.createElement('span');icon.className='upgrade-icon';icon.textContent=u.icon;const name=document.createElement('strong');name.textContent=u.name;const p=document.createElement('p');p.textContent=u.desc;const small=document.createElement('small');small.textContent=`LEVEL ${(state.upgrades[id]||0)+1} · SELECT UPGRADE →`;b.append(icon,name,p,small);b.onclick=()=>{if(state.phase!=='upgrade'||paused)return;const input={x:0,z:0,yaw,upgrade:id};session?.record(input);E.step(state,input);audio.play('upgrade');clearInput();accumulator=0;show(null);banner(`WAVE ${String(state.wave).padStart(2,'0')}`,[view.venueName?.(state.wave),state.wave%5===0?'GIANT INBOUND':''].filter(Boolean).join(' · '));};$('upgradeChoices').append(b);}
  session?.flush().catch(()=>{});
 }
 function results(){clearInput();saveBest();show('resultScreen');$('deathReason').textContent=state.reason+'. Every run builds a better fighter.';$('resultWave').textContent=state.wave;$('resultScore').textContent=state.score.toLocaleString();$('resultKills').textContent=state.kills;$('resultParts').textContent=state.severed;$('rewardStatus').textContent=session?.status().practice===false?'Verifying your run…':'Practice score saved on this device. Coins and global records require the approved verified release.';session?.flush(true).then(rewardStatus).catch(rewardStatus);}
 function rewardStatus(){const r=session?.status();if(!r||r.practice)return;$('rewardStatus').textContent=r.error?'Verification unavailable. Your personal best is saved; no unverified coins were awarded.':r.pending?'Verifying your run…':`${r.earned} Arcade Coins confirmed by Earnly.`;}
 function hud(){const p=state.player;$('wave').textContent=String(state.wave).padStart(2,'0');$('remaining').textContent=(state.enemies.filter(e=>e.alive).length+state.queue.length)+' HOSTILES';$('condition').textContent=Math.max(0,Math.ceil(p.hp.core))+' / '+p.max.core;$('healthFill').style.width=Math.max(0,p.hp.core/p.max.core*100)+'%';$('energyFill').style.width=state.energy+'%';$('score').textContent=state.score.toLocaleString();const parts=Object.entries(p.hp).filter(([k,v])=>!['head','core'].includes(k)&&v<=0);$('limbStatus').textContent=parts.length?parts.length+' SEGMENT'+(parts.length>1?'S':'')+' LOST':'CHASSIS INTACT';}
 function input(){let x=joy.x+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),forward=-joy.y+(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);const len=Math.hypot(x,forward);if(len>1){x/=len;forward/=len;}return {x:x*Math.cos(yaw)+forward*Math.sin(yaw),z:x*Math.sin(yaw)-forward*Math.cos(yaw),yaw,attack:held.attack,block:held.block||keys.has('KeyQ'),jump:held.jump||keys.has('Space'),dodge:held.dodge||keys.has('ShiftLeft')||keys.has('ShiftRight')};}
 function events(){view.effects(state.events);for(const e of state.events){if(e.type==='wave')continue;if(e.type==='swing'&&e.id!==0)continue;audio.play(e.type);if(e.type==='parry'&&e.id===0)feedback('PERFECT PARRY');if(e.type==='sever'&&e.id!==0)feedback(e.part.endsWith('Arm')?'WEAPON ARM SEVERED':e.part.endsWith('Leg')?'MOBILITY DESTROYED':'CRITICAL CUT');if(e.type==='hit'&&e.id===0)hurtUntil=performance.now()+180;if((e.type==='destroy'||e.type==='sever')&&e.id!==0&&!view.reduced)hitStopUntil=performance.now()+(e.type==='destroy'?75:40);}}
 function frame(now){requestAnimationFrame(frame);if(!view)return;const dt=Math.min(.1,(now-(last||now))/1000);last=now;
  if(playing&&!paused&&state.phase==='combat'){
   yaw+=turn*2.8*dt;accumulator+=dt*(now<hitStopUntil?.18:1);let count=0;while(accumulator>=E.DT&&count++<4&&state.phase==='combat'){const raw=input(),v=session?.record(raw)||raw;E.step(state,v);events();accumulator-=E.DT;}
   if(count>=4)accumulator=0;
  }
  if(playing&&!paused&&state.phase!==phase){phase=state.phase;if(phase==='upgrade')upgrades();else if(phase==='dead')results();}
  if(playing){hud();if(!paused&&state.phase==='combat'){const foot=Math.floor(state.player.walk/Math.PI);if(foot!==lastFoot&&state.player.y===0){audio.play('step');lastFoot=foot;}if(now>ambienceDue){audio.play('ambient');ambienceDue=now+2400;}}}if(now>bannerUntil)$('waveBanner').classList.remove('show');if(now>feedbackUntil)$('feedback').textContent='';$('hurt').style.opacity=now<hurtUntil?'1':'0';
  view.render(state,paused?0:dt,yaw,pitch,!playing);
  if(coarse&&playing&&!paused&&!autoLow){if(dt>.046)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);if(slowFrames>100){autoLow=true;view.setQuality(true);$('quality').textContent='Graphics: performance';feedback('PERFORMANCE MODE');}}
 }
 for(const id of ['start','restart','replay'])$(id).onclick=start;
 $('pause').onclick=pause;$('upgradePause').onclick=pause;$('resume').onclick=resume;
 $('menu').onclick=()=>{startGeneration++;playing=false;paused=false;clearInput();state=E.create(17);view.reset();show('intro');};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('arena').requestFullscreen?.();}catch{}view.resize();};
 function toggleSound(){sound=!sound;try{localStorage.setItem('earnly.metalMayhem.sound',sound?'on':'off');}catch{}for(const id of ['sound','soundIntro'])$(id).textContent='Sound '+(sound?'on':'off');if(sound)audio.init();else audio.ctx?.suspend().catch(()=>{});}
 $('sound').onclick=toggleSound;$('soundIntro').onclick=toggleSound;for(const id of ['sound','soundIntro'])$(id).textContent='Sound '+(sound?'on':'off');
 $('cameraDistance').onclick=()=>{cameraMode=['wide','far','close'][(['wide','far','close'].indexOf(cameraMode)+1)%3];view.setCameraMode(cameraMode);$('cameraDistance').textContent='Camera: '+cameraMode;try{localStorage.setItem('earnly.metalMayhem.camera',cameraMode);}catch{}};
 $('quality').onclick=()=>{view.setQuality(!view.low);autoLow=true;$('quality').textContent='Graphics: '+(view.low?'performance':'balanced');};
 $('helpOpen').onclick=()=>{helpReturn='intro';show('helpScreen');};$('helpPause').onclick=()=>{helpReturn='pauseScreen';show('helpScreen');};$('helpClose').onclick=()=>show(helpReturn);
 $('rankOpen').onclick=async()=>{show('rankScreen');$('rankList').replaceChildren();$('rankStatus').textContent='Connecting to verified records…';try{const r=await window.MetalMayhemRewards.leaderboard();$('rankStatus').textContent=r.entries?.length?'Verified Endless Arena scores':'No verified runs yet.';for(const row of r.entries||[]){const li=document.createElement('li');li.textContent=`${row.username} · wave ${row.wave} · ${Number(row.score).toLocaleString()}`;$('rankList').append(li);}}catch{$('rankStatus').textContent='Global records open with the approved verified release. Your personal best is wave '+best.wave+' · '+best.score.toLocaleString()+'.';}};$('rankClose').onclick=()=>show('intro');
 $('reload').onclick=()=>location.reload();
 for(const name of ['attack','block','jump','dodge']){const el=$(name);el.addEventListener('pointerdown',e=>{if(paused||state.phase!=='combat')return;e.preventDefault();e.stopPropagation();el.setPointerCapture(e.pointerId);buttonIds.set(e.pointerId,name);held[name]=true;el.classList.add('pressed');audio.init();});const end=e=>{if(buttonIds.get(e.pointerId)!==name)return;buttonIds.delete(e.pointerId);held[name]=false;el.classList.remove('pressed');};for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,end);}
 const stick=$('joystick');function steer(e){if(e.pointerId!==joyId)return;const r=stick.getBoundingClientRect(),radius=r.width*.34;let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;const d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}joy={x,y};$('stick').style.transform=`translate(${x*radius}px,${y*radius}px)`;}
 stick.addEventListener('pointerdown',e=>{if(!playing||paused||state.phase!=='combat'||joyId!==null)return;joyId=e.pointerId;stick.setPointerCapture(e.pointerId);e.preventDefault();steer(e);});stick.addEventListener('pointermove',steer);for(const ev of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(ev,e=>{if(e.pointerId===joyId){joyId=null;joy={x:0,y:0};$('stick').style.transform='';}});
 // A horizontal rate pad keeps turning while held; vertical movement never tilts the mobile view.
 const turnPad=$('turnPad');
 function turnSteer(e){if(e.pointerId!==turnId)return;e.preventDefault();const r=turnPad.getBoundingClientRect(),dx=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width*.36)));turn=Math.abs(dx)<.12?0:Math.sign(dx)*(Math.abs(dx)-.12)/.88;$('turnStick').style.transform=`translateX(${dx*r.width*.30}px)`;}
 turnPad.addEventListener('pointerdown',e=>{if(!playing||paused||state.phase!=='combat'||turnId!==null||look)return;e.preventDefault();e.stopPropagation();turnId=e.pointerId;turnPad.setPointerCapture(e.pointerId);turnSteer(e);});
 turnPad.addEventListener('pointermove',turnSteer);
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])turnPad.addEventListener(ev,e=>{if(e.pointerId===turnId){turnId=null;turn=0;$('turnStick').style.transform='';}});
 // Keep combat gestures inside the arena while allowing menu panels to scroll.
 $('arena').addEventListener('touchmove',e=>{if(playing&&!paused&&state.phase==='combat'&&e.cancelable)e.preventDefault();},{passive:false});
 $('arena').addEventListener('gesturestart',e=>{if(playing&&!paused&&state.phase==='combat')e.preventDefault();},{passive:false});
 const canvas=$('arenaCanvas');canvas.addEventListener('pointerdown',e=>{if(!playing||paused||state.phase!=='combat')return;e.preventDefault();if(e.pointerType==='mouse'){if(e.button===0)held.attack=true;if(e.button===2)held.block=true;try{const lock=canvas.requestPointerLock?.();lock?.catch?.(()=>{});}catch{}}if(!look&&turnId===null&&(e.pointerType==='mouse'||e.clientX>innerWidth*.32)){look={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
 canvas.addEventListener('pointermove',e=>{if(!playing||paused)return;if(document.pointerLockElement===canvas){yaw+=e.movementX*.0035;pitch=Math.max(-.3,Math.min(1,e.movementY*.003+pitch));}else if(look?.id===e.pointerId){yaw+=(e.clientX-look.x)*(e.pointerType==='mouse'?.006:.010);if(e.pointerType==='mouse'&&!coarse)pitch=Math.max(-.3,Math.min(1,pitch+(e.clientY-look.y)*.004));look.x=e.clientX;look.y=e.clientY;}});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>{if(look?.id===e.pointerId)look=null;if(e.pointerType==='mouse'&&(ev!=='lostpointercapture'||document.pointerLockElement!==canvas)){held.attack=false;held.block=false;}});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 document.addEventListener('keydown',e=>{if(e.code==='Escape'){if(playing){paused?resume():pause();}return;}if(!playing||paused)return;if(['KeyW','KeyA','KeyS','KeyD','KeyQ','Space','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}});document.addEventListener('keyup',e=>keys.delete(e.code));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();session?.flush().catch(()=>{});}});
 // On touch browsers, loss of focus alone does not mean the arena is hidden.
 // Release held controls on every blur; reserve mobile auto-pause for page hiding.
 window.addEventListener('blur',()=>{clearInput();if(!coarse||document.hidden)pause();});
 window.addEventListener('pagehide',()=>{clearInput();pause();session?.flush(true).catch(()=>{});});
 window.addEventListener('resize',()=>{clearInput();view?.resize();});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('errorTitle').textContent='Graphics were interrupted.';$('errorMessage').textContent='Reload to restore the arena. Your previous personal records are safe.';show('errorScreen');});
 if(!coarse)$('controlHint').textContent='WASD to move · click to strike · mouse to aim. Space jumps, Shift dodges, Q blocks.';
 bestLabel();
 try{view=new window.MetalMayhemView(canvas);view.setCameraMode(cameraMode);$('cameraDistance').textContent='Camera: '+cameraMode;$('start').disabled=false;$('start').textContent='Enter the arena →';if(coarse)$('quality').textContent='Graphics: balanced';requestAnimationFrame(frame);}catch(error){console.error('Metal Mayhem renderer unavailable',error);show('errorScreen');}
 // Diagnostic state is never submitted as a score or a reward claim.
 if(new URLSearchParams(location.search).has('qa'))window.__metalMayhem={get state(){return state;},get input(){return input();},get paused(){return paused;},get yaw(){return yaw;},get pitch(){return pitch;},get view(){return view;},get session(){return session;},stats:()=>view?.stats()};
})();
