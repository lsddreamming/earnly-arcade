(()=>{
'use strict';
// iPhone Safari remains playable; computers and tablets never start the game
// or request camera access. Native room tracking has its own hardware gate.
if(!/\biPhone\b/i.test(navigator.userAgent))return;
document.getElementById('phoneOnly').hidden=true;
document.getElementById('intro').hidden=false;
const $=id=>document.getElementById(id), canvas=$('scene'), c=canvas.getContext('2d'), video=$('camera');
const {Game,types}=window.AlienDemo, game=new Game();
let w=innerWidth,h=innerHeight,dpr=1,stream=null,epoch=0,phase='intro',previous=0,aim={x:w*.5,y:h*.45},held=false,recoil=0,flash=0,particles=[],traces=[],sound=null,muted=false,oldHealth=100,needsCamera=false,lastWave=1,modalKind='pause';
const show=(id,yes)=>$(id).hidden=!yes;
function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;c.setTransform(dpr,0,0,dpr,0,0);aim={x:w*.5,y:h*.45};drawHero();}
function ellipse(ctx,x,y,rx,ry,fill,rotation=0){ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rotation,0,Math.PI*2);ctx.fill();}
function orb(ctx,x,y,rx,ry,light,dark){const g=ctx.createRadialGradient(x-rx*.34,y-ry*.36,1,x,y,Math.max(rx,ry));g.addColorStop(0,light);g.addColorStop(1,dark);ellipse(ctx,x,y,rx,ry,g);}
function alien(ctx,x,y,r,type,t,hit=0){
  const pal=types[type], body=hit?'#fff':pal.color,dark=hit?'#9cecff':pal.dark;
  ctx.save();ctx.translate(x,y);const bob=Math.sin(t*8)*r*.035;ctx.translate(0,bob);
  ellipse(ctx,0,r*1.06,r*.63,r*.13,'#03081840');
  for(const side of [-1,1]){
    const step=Math.sin(t*8+side*Math.PI/2)*r*.14;
    orb(ctx,side*r*.35,r*.7+step,r*.24,r*.38,body,dark);orb(ctx,side*r*.38,r*.97+step,r*.28,r*.14,body,dark);
    orb(ctx,side*r*.67,r*.13-step,r*.23,r*.4,body,dark);
    for(let i=0;i<3;i++)orb(ctx,side*r*.69+(i-1)*r*.085,r*.48-step,r*.055,r*.11,body,dark);
  }
  orb(ctx,0,r*.25,r*.57,r*.68,body,dark);orb(ctx,0,r*.3,r*.32,r*.4,type===2?'#ffdfa1':type===1?'#d6b7f2':'#d7ff99',dark);
  if(type>0){
    for(const side of [-1,1]){orb(ctx,side*r*.57,-r*.06,r*.33,r*.26,'#a2b0d0','#26304e');ellipse(ctx,side*r*.58,-r*.1,r*.16,r*.04,'#d2f7ff');}
    orb(ctx,0,r*.25,r*.45,r*.3,'#7784b1','#283451');ellipse(ctx,0,r*.24,r*.12,r*.12,type===1?'#f291ff':'#ffcf6a');
  }
  // Head, cheeks, expressive eyes and antennae are independently shaded.
  for(const side of [-1,1]){ctx.strokeStyle=dark;ctx.lineWidth=r*.075;ctx.beginPath();ctx.moveTo(side*r*.25,-r*.65);ctx.quadraticCurveTo(side*r*.38,-r*1.18,side*r*.6,-r*1.1);ctx.stroke();orb(ctx,side*r*.6,-r*1.1,r*.12,r*.12,body,dark);}
  orb(ctx,0,-r*.4,r*.7,r*.6,body,dark);
  for(const side of [-1,1]){
    orb(ctx,side*r*.28,-r*.45,r*.265,r*.29,'#fffef2','#c1d6c3');
    ellipse(ctx,side*r*.28,-r*.42,r*.125,r*.2,'#132741',side*.12);
    ellipse(ctx,side*r*.28-r*.035,-r*.5,r*.04,r*.065,'white');
    ellipse(ctx,side*r*.51,-r*.1,r*.09,r*.045,type===0?'#d6b56f':'#e79bbb');
    if(type===2){ctx.strokeStyle='#91574d';ctx.lineWidth=r*.09;ctx.beginPath();ctx.moveTo(side*r*.1,-r*.72);ctx.lineTo(side*r*.5,-r*.82);ctx.stroke();}
  }
  ellipse(ctx,0,-r*.035,r*.22,r*.1,'#1c2543');
  for(const side of [-1,1]){ctx.fillStyle='#fcfff1';ctx.fillRect(side*r*.08-r*.04,-r*.09,r*.09,r*.09);}
  ellipse(ctx,-r*.23,-r*.79,r*.14,r*.035,'#ffffff70',-.25);
  if(type===2){orb(ctx,-r*.6,-r*.78,r*.13,r*.28,'#f7e9b0','#ab995c');orb(ctx,r*.6,-r*.78,r*.13,r*.28,'#f7e9b0','#ab995c');}
  ctx.restore();
}
function drawHero(){const el=$('hero'),cw=el.clientWidth||400,ch=el.clientHeight||208;el.width=cw*2;el.height=ch*2;const cx=el.getContext('2d');cx.scale(2,2);const g=cx.createRadialGradient(cw/2,ch*.57,10,cw/2,ch*.57,cw*.45);g.addColorStop(0,'#73c6f32b');g.addColorStop(1,'#73c6f300');cx.fillStyle=g;cx.fillRect(0,0,cw,ch);cx.strokeStyle='#73aecc25';cx.lineWidth=1;for(let i=0;i<3;i++){cx.beginPath();cx.ellipse(cw/2,ch*.67,cw*(.3+i*.05),ch*(.15+i*.05),-.12,0,Math.PI*2);cx.stroke();}alien(cx,cw*.23,ch*.55,ch*.27,1,1);alien(cx,cw*.76,ch*.55,ch*.3,2,1.7);alien(cx,cw*.5,ch*.5,ch*.36,0,.2);}
function portal(p,i,t){const x=p.x*w,y=p.y*h,r=Math.min(w,h)*.1; c.save();c.translate(x,y);c.shadowColor='#b778ff';c.shadowBlur=18;c.strokeStyle='#c894ff';c.lineWidth=3;c.beginPath();c.ellipse(0,0,r*.7,r,0,0,Math.PI*2);c.stroke();c.shadowBlur=0;const g=c.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'#291a5540');g.addColorStop(1,'#bd80ff30');ellipse(c,0,0,r*.7,r,g);for(let j=0;j<7;j++){const a=j/7*Math.PI*2+t;ellipse(c,Math.cos(a)*r*.7,Math.sin(a)*r,2,3,'#f0d4ff');}c.font='800 9px system-ui';c.textAlign='center';c.fillStyle='#fff';c.fillText('PORTAL '+(i+1),0,r+18);c.restore();}
function gun(t){const r=Math.min(w*.23,92),x=w*.64,y=h*.82+recoil*10;const color=game.weapon?'#95ff65':'#69ddff';c.save();c.translate(x,y);c.rotate(-.25+recoil*.04);c.lineJoin='round';c.strokeStyle='#071321';c.lineWidth=5;c.fillStyle='#1a2b45';c.beginPath();c.moveTo(-r*.2,r*.4);c.lineTo(-r*.4,r*1.5);c.lineTo(r*.17,r*1.5);c.lineTo(r*.35,r*.3);c.closePath();c.fill();c.stroke();const g=c.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#8292ad');g.addColorStop(.3,'#415b7d');g.addColorStop(.7,'#182c47');g.addColorStop(1,'#080f1d');c.fillStyle=g;c.beginPath();c.roundRect(-r*.7,-r*.5,r*1.25,r*.95,r*.18);c.fill();c.stroke();c.fillStyle=color;c.shadowColor=color;c.shadowBlur=12;c.beginPath();c.roundRect(-r*.53,-r*.33,r*.55,r*.13,4);c.fill();c.shadowBlur=0;c.fillStyle='#a4b9c9';c.beginPath();c.roundRect(-r*.4,-r*1.05,r*.48,r*.65,7);c.fill();orb(c,-r*.16,-r*1.03,r*.3,r*.14,'#627184','#142738');ellipse(c,-r*.16,-r*1.03,r*.17,r*.075,color);c.fillStyle='#13243a';c.fillRect(r*.14,-r*.32,r*.25,r*.52);c.fillStyle=color;for(let i=0;i<3;i++)c.fillRect(r*.18,-r*.22+i*r*.14,r*.16,r*.045);if(flash>0){c.shadowColor=color;c.shadowBlur=30;ellipse(c,-r*.16,-r*1.2,r*.22+flash*35,r*.35+flash*40,'#ecffff');}c.restore();return{x:x-r*.18,y:y-r};}
function burst(x,y,color,big){for(let i=0;i<(big?24:9);i++){const a=Math.random()*Math.PI*2,s=30+Math.random()*(big?220:100);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.3,color,size:2+Math.random()*4});}if(particles.length>220)particles.splice(0,particles.length-220);}
function audio(){if(!sound){const Audio=window.AudioContext||window.webkitAudioContext;if(Audio)sound=new Audio();}sound?.resume().catch(()=>{});}
function tone(hit=false){if(!sound||muted)return;try{const o=sound.createOscillator(),g=sound.createGain();o.type=game.weapon?'sawtooth':'sine';o.frequency.setValueAtTime(hit?280:game.weapon?180:880,sound.currentTime);o.frequency.exponentialRampToValueAtTime(hit?65:70,sound.currentTime+.13);g.gain.setValueAtTime(.055,sound.currentTime);g.gain.exponentialRampToValueAtTime(.001,sound.currentTime+.17);o.connect(g);g.connect(sound.destination);o.start();o.stop(sound.currentTime+.18);}catch{}}
function shoot(){const r=game.shoot(aim.x,aim.y,w,h);if(!r.fired){if(!game.ammo[game.weapon]&&!game.reload)$('hint').textContent='Out of energy cells · tap RELOAD';return;}recoil=1;flash=.1;tone(r.hit);traces.push({x:aim.x,y:aim.y,life:.1,color:game.weapon?'#a3ff66':'#74e5ff'});if(r.hit)burst(r.x,r.y,r.color,r.killed);if(r.killed&&navigator.vibrate)navigator.vibrate(12);updateHUD();}
function updateHUD(){$('healthBar').style.width=game.health+'%';$('stats').textContent=`${game.score.toLocaleString()} PTS · ${game.kills} KILLS · ${game.health} HP`;$('wave').textContent=`${game.wave} / 3`;$('ammo').textContent=game.reload?'…':`${game.ammo[game.weapon]} / ${game.capacity}`;$('weaponName').textContent=game.weapon?'Alien Zapper ⇄':'Plasma Blaster ⇄';$('weapon').style.borderColor=game.weapon?'#a6ff6966':'#4edcff66';}
function stopCamera(){if(stream){const old=stream;stream=null;old.getTracks().forEach(t=>{t.onended=null;t.stop();});}video.pause();video.srcObject=null;}
function cameraError(e){if(e.name==='NotAllowedError'||e.name==='SecurityError')return 'Camera permission was blocked. In Safari, open the page menu → Website Settings → Camera → Allow, then try again. If you opened this inside another app, use Open in Safari.';if(e.name==='NotFoundError'||e.name==='OverconstrainedError')return 'No usable camera was found. Open this page on your iPhone in Safari and try again.';if(e.name==='NotReadableError'||e.name==='AbortError')return 'The camera is busy or was interrupted. Close other camera apps and try again.';return 'The camera could not start. Open this HTTPS page directly in Safari and try again.';}
async function connectCamera(){
  if(!isSecureContext)throw new Error('HTTPS required');
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera API unavailable');
  const token=++epoch;let s;
  try{s=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}});
    if(token!==epoch){s.getTracks().forEach(t=>t.stop());return false;}
    stream=s;video.srcObject=s;await video.play();
    if(token!==epoch){s.getTracks().forEach(t=>t.stop());return false;}
    if(document.hidden){stopCamera();throw new Error('Page hidden');}
    s.getVideoTracks().forEach(t=>t.onended=()=>{if(stream===s){needsCamera=true;pause('Camera disconnected. Tap Resume to reconnect.');stopCamera();}});
    needsCamera=false;return true;
  }catch(e){if(token!==epoch)return false;stopCamera();throw e;}
}
function modal(title,text,kind){modalKind=kind;$('modalTitle').textContent=title;$('modalText').textContent=text;show('modal',true);show('resume',kind==='pause'||kind==='error'||kind==='info');show('restart',kind==='pause'||kind==='result');$('resume').textContent=kind==='error'?'Try camera again':kind==='info'?'Back to playtest':'Resume';$('home').textContent=kind==='info'?'Close':'Exit to start';}
async function play(){
  if(phase==='connecting')return;audio();phase='connecting';modal('Opening camera','Choose Allow when Safari asks. Your live view stays on this device.','loading');
  try{if(!await connectCamera())return;game.reset();game.portals=[];particles=[];traces=[];phase='setup';show('intro',false);show('modal',false);show('hud',true);show('mode',true);show('hint',true);show('setup',true);show('controls',false);$('pause').disabled=true;$('hint').textContent='Point at an entrance. Tap the view to place a glowing portal.';updatePortals();updateHUD();
  }catch(e){phase='error';modal('Camera needs attention',cameraError(e),'error');}
}
function updatePortals(){$('defend').disabled=!game.portals.length;$('defend').textContent=game.portals.length?`Defend · ${game.portals.length} portal${game.portals.length>1?'s':''}`:'Place a portal first';}
function defend(){if(!stream){modal('Camera stopped','Tap Try camera again to reconnect.','error');phase='error';return;}game.reset();game.start();phase='playing';oldHealth=100;lastWave=1;held=false;recoil=0;particles=[];traces=[];aim={x:w*.5,y:h*.45};show('setup',false);show('controls',true);show('modal',false);$('pause').disabled=false;$('hint').textContent='Tap an alien to shoot · drag to aim · hold FIRE';audio();updateHUD();}
function pause(message='Take a breath. Your invasion is frozen.'){if(phase!=='playing')return;held=false;game.state='paused';phase='paused';modal('Invasion paused',message,'pause');}
async function resume(){if(modalKind==='info'){show('modal',false);return;}if(modalKind==='error'){await play();return;}if(phase!=='paused')return;audio();if(needsCamera||!stream){try{if(!await connectCamera())return;}catch(e){$('modalText').textContent=cameraError(e);return;}}phase='playing';game.state='playing';show('modal',false);previous=0;}
function home(){epoch++;stopCamera();held=false;phase='intro';game.reset();game.portals=[];particles=[];traces=[];show('intro',true);show('modal',false);for(const id of ['hud','mode','hint','setup','controls'])show(id,false);$('waveBanner').textContent='';$('damage').style.opacity=0;}
function point(e){const rect=canvas.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top};}
canvas.addEventListener('pointerdown',e=>{if(phase==='setup'){const p=point(e);game.addPortal(p.x/w,p.y/h);updatePortals();tone();return;}if(phase!=='playing')return;e.preventDefault();canvas.setPointerCapture(e.pointerId);aim=point(e);shoot();});
canvas.addEventListener('pointermove',e=>{if(phase==='playing'&&e.buttons){aim=point(e);}});
$('fire').addEventListener('pointerdown',e=>{if(phase!=='playing')return;e.preventDefault();audio();$('fire').setPointerCapture(e.pointerId);held=true;shoot();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('fire').addEventListener(event,()=>held=false);
$('play').onclick=play;$('defend').onclick=defend;$('clear').onclick=()=>{game.portals=[];updatePortals();};$('pause').onclick=()=>pause();$('exit').onclick=home;$('home').onclick=()=>modalKind==='info'?show('modal',false):home();$('resume').onclick=resume;$('restart').onclick=()=>{if(stream)defend();else play();};$('reload').onclick=()=>{game.beginReload();$('hint').textContent='Reloading energy cells…';};$('weapon').onclick=()=>{game.changeWeapon();updateHUD();};$('nativeInfo').onclick=()=>modal('True room tracking','The room-tracked game runs inside the Earnly Arcade iPhone app, using ARKit world anchors, 3D enemies and optional RoomPlan scanning. Its TestFlight build is being prepared.\n\nPhysical room tracking and the 180° turn test have not yet been verified. This browser demo cannot perform that test.','info');
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause('App switched. Tap Resume to reconnect your camera.');if(phase==='setup'){home();return;}needsCamera=true;stopCamera();}});addEventListener('pagehide',home);addEventListener('blur',()=>pause());addEventListener('resize',resize);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&phase==='playing'){e.preventDefault();held=true;}if(e.code==='KeyR')game.beginReload();if(e.code==='KeyQ'){game.changeWeapon();updateHUD();}if(e.code==='Escape')pause();});document.addEventListener('keyup',e=>{if(e.code==='Space')held=false;});
function frame(now){const dt=Math.min(.04,previous?(now-previous)/1000:0);previous=now;c.clearRect(0,0,w,h);
  if(phase==='setup'||phase==='playing'||phase==='paused'||phase==='result'){
    game.portals.forEach((p,i)=>portal(p,i,now/1000));
    if(phase==='playing'){game.update(dt);if(held)shoot();recoil=Math.max(0,recoil-dt*7);flash=Math.max(0,flash-dt);if(game.health<oldHealth){$('damage').style.opacity=.8;oldHealth=game.health;}else $('damage').style.opacity=Math.max(0,Number($('damage').style.opacity)-dt*2);}
    for(const a of [...game.enemies].sort((a,b)=>a.depth-b.depth)){const b=game.bounds(a,w,h);alien(c,b.x,b.y,b.r,a.type,a.age,a.hit);if(a.hp<types[a.type].hp){c.fillStyle='#091326c0';c.fillRect(b.x-b.r*.5,b.y-b.r*1.4,b.r,4);c.fillStyle='#c4ff7a';c.fillRect(b.x-b.r*.5,b.y-b.r*1.4,b.r*a.hp/types[a.type].hp,4);}}
    if(phase!=='setup'){
      const tip=gun(now);c.save();c.strokeStyle=game.weapon?'#b9ff87':'#d7faff';c.lineWidth=1.5;c.beginPath();c.arc(aim.x,aim.y,13,0,Math.PI*2);c.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2;c.beginPath();c.moveTo(aim.x+Math.cos(a)*17,aim.y+Math.sin(a)*17);c.lineTo(aim.x+Math.cos(a)*23,aim.y+Math.sin(a)*23);c.stroke();}c.restore();
      for(const t of traces){c.globalAlpha=t.life/.1;c.strokeStyle=t.color;c.lineWidth=game.weapon?5:3;c.shadowColor=t.color;c.shadowBlur=14;c.beginPath();c.moveTo(tip.x,tip.y);c.lineTo(t.x,t.y);c.stroke();if(phase==='playing')t.life-=dt;}c.globalAlpha=1;c.shadowBlur=0;traces=traces.filter(t=>t.life>0);
      for(const p of particles){if(phase==='playing'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=100*dt;p.life-=dt;}c.globalAlpha=Math.max(0,p.life*2);ellipse(c,p.x,p.y,p.size,p.size,p.color);}c.globalAlpha=1;particles=particles.filter(p=>p.life>0);
      $('waveBanner').textContent=game.break>0?`WAVE ${game.wave} INCOMING`:'';
      if(phase==='playing'){updateHUD();if(game.reload===0&&$('hint').textContent==='Reloading energy cells…')$('hint').textContent='Energy restored · tap an alien or hold FIRE';if(game.state==='won'||game.state==='lost'){phase='result';held=false;modal(game.state==='won'?'ROOM DEFENDED':'THEY GOT THROUGH',`${game.score.toLocaleString()} points · ${game.kills} aliens defeated\n${game.state==='won'?'All three waves survived. Your room is yours again.':'Switch to the Zapper for armored aliens. Keep those energy cells loaded.'}`,'result');}}
    }
  }
  requestAnimationFrame(frame);
}
resize();requestAnimationFrame(frame);
})();
