(()=>{
'use strict';
const E=NeonBreachEngine,game='neonBreach',canvas=document.getElementById('game'),message=document.getElementById('arenaMessage'),pad=document.getElementById('movePad'),knob=document.getElementById('moveKnob'),fireButton=document.getElementById('fireButton'),els=Object.fromEntries(['score','health','wave','plays','balance','gameStatus','startButton'].map(id=>[id,document.getElementById(id)]));
let state=E.create(),running=false,starting=false,paused=false,last=0,raf=0,moveId=null,aimId=null,fireId=null,aimX=0,joy={forward:0,strafe:0},keys=new Set(),pauseControl;

function resetInput(){moveId=aimId=fireId=null;joy={forward:0,strafe:0};keys.clear();knob.style.transform='';fireButton.classList.remove('firing')}
function chrome(){const values={score:state.score,health:state.player.hp,wave:Math.max(1,state.wave),plays:Arcade.remaining(game),balance:Arcade.number('points').toLocaleString()};for(const [key,value] of Object.entries(values))if(els[key].textContent!==String(value))els[key].textContent=value;els.health.parentElement.classList.toggle('critical',state.player.hp<=25)}
function status(text,active){els.gameStatus.textContent=text;els.gameStatus.classList.toggle('running',!!active);document.body.classList.toggle('game-active',!!active)}
const renderer=NeonBreachRenderer.create(canvas),audio=NeonBreachAudio;
let lastComms=-20,captionUntil=0,lowHealth=false;
const comms=document.getElementById('robotComms'),soundButton=document.getElementById('soundButton'),voiceButton=document.getElementById('voiceButton');
function render(dt=0,moving=false){renderer.render(state,{running,dt,moving})}
function say(id,force=false){if(!force&&state.time-lastComms<7)return;lastComms=state.time;audio.voice(id,force);comms.textContent=NeonBreachVoices.clips[id].text;comms.hidden=false;captionUntil=state.time+2.5}
function soundControls(){const sound=Arcade.soundEnabled(),voice=audio.voicesEnabled();soundButton.textContent=sound?'♫ Sound on':'♫ Sound off';soundButton.setAttribute('aria-pressed',String(sound));voiceButton.textContent=voice?'◉ Voice on':'◉ Voice off';voiceButton.setAttribute('aria-pressed',String(voice))}
soundButton.addEventListener('click',()=>{localStorage.setItem('arcadeSound',Arcade.soundEnabled()?'off':'on');if(Arcade.soundEnabled()&&!paused)audio.unlock();else audio.suspend();soundControls()});
voiceButton.addEventListener('click',()=>{localStorage.setItem('neonBreachVoice',audio.voicesEnabled()?'off':'on');audio.stop();if(Arcade.soundEnabled()&&!paused)audio.unlock();soundControls()});
function events(){
 for(const event of state.events){renderer.event(event);
  if(event.type==='fire')audio.effect('fire',state.overdrive>0);
  else if(event.type==='impact'){audio.effect(event.killed?'kill':'hit');if(event.killed&&state.kills%5===0)say('failing')}
  else if(event.type==='damage')audio.effect(event.shield?'shield':'damage');
  else if(event.type==='pickup'){audio.effect('pickup');if(event.kind!=='health')say(event.kind,true)}
  else if(event.type==='wave'){audio.effect('wave');say(state.wave===1?'acquired':state.wave%3===0?'heavy':['pursuit','resistance','hide'][(state.wave-2)%3])}
 }
 state.events.length=0;
 if(state.player.hp<=25&&!lowHealth){lowHealth=true;say('critical',true)}else if(state.player.hp>35)lowHealth=false;
 if(state.time>captionUntil)comms.hidden=true;
}

function loop(now){if(!running||paused)return;const dt=Math.min(.05,(now-last)/1000);last=now;const input={forward:joy.forward+(keys.has('w')||keys.has('ArrowUp')?1:0)-(keys.has('s')||keys.has('ArrowDown')?1:0),strafe:joy.strafe+(keys.has('d')?1:0)-(keys.has('a')?1:0),turn:(keys.has('ArrowRight')?2:0)-(keys.has('ArrowLeft')?2:0),fire:fireId!==null||keys.has(' ')};E.tick(state,dt,input);events();chrome();render(dt,Math.hypot(input.forward,input.strafe)>.1);fireButton.classList.toggle('firing',input.fire);if(state.ended){finish();return}raf=requestAnimationFrame(loop)}
function finish(){if(!running)return;running=false;audio.stop();if(state.time>=180)audio.voice('complete',true);comms.hidden=true;resetInput();cancelAnimationFrame(raf);status('Run Over',false);els.startButton.textContent='▶ PLAY AGAIN';message.hidden=false;message.innerHTML='RUN COMPLETE<span>Ready for another breach?</span>';const coins=Math.min(25,Math.floor(state.score/150));Arcade.earn(coins,'Neon Breach',{kind:'game',game,metric:state.score,aux:state.kills});const result=Arcade.recordResult(game,state.score);chrome();Arcade.gameResult({game,icon:'🤖',title:state.time>=180?'Breach Complete':'Neon Breach Run Over',scoreLabel:'POINTS',score:state.score,best:Arcade.best(game).display,coins,result,playsLeft:Arcade.remaining(game),extra:[`🤖 Robots defeated: ${state.kills}`,`⚡ Wave reached: ${state.wave}`,`⏱️ Time played: ${Math.round(state.time)}s`,`◎ Accuracy: ${state.fired?Math.round(state.hits/state.fired*100):0}%`],onReplay:start,onMorePlays:()=>Arcade.out(game,chrome)})}
function start(){if(running||starting)return;audio.unlock();audio.reset();renderer.reset();lastComms=-20;lowHealth=false;comms.hidden=true;if(!Arcade.consume(game)){Arcade.out(game,chrome);return}starting=true;els.startButton.disabled=true;resetInput();state=E.create();message.hidden=true;render();Arcade.countdown(()=>{starting=false;running=true;paused=false;els.startButton.disabled=false;status('Running',true);chrome();last=performance.now();raf=requestAnimationFrame(loop)})}
els.startButton.addEventListener('click',start);
function capture(el,e){e.preventDefault();el.setPointerCapture(e.pointerId)}
pad.addEventListener('pointerdown',e=>{if(!running||paused||moveId!==null)return;moveId=e.pointerId;capture(pad,e);steer(e)});function steer(e){const r=pad.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/32,dy=(e.clientY-r.top-r.height/2)/32,n=Math.max(1,Math.hypot(dx,dy));joy={strafe:dx/n,forward:-dy/n};knob.style.transform=`translate(${joy.strafe*28}px,${-joy.forward*28}px)`}pad.addEventListener('pointermove',e=>{if(e.pointerId===moveId){e.preventDefault();steer(e)}});
canvas.addEventListener('pointerdown',e=>{if(!running||paused||aimId!==null)return;aimId=e.pointerId;aimX=e.clientX;capture(canvas,e)});canvas.addEventListener('pointermove',e=>{if(e.pointerId===aimId&&running&&!paused){e.preventDefault();state.player.a=E.angle(state.player.a+(e.clientX-aimX)*.008);aimX=e.clientX}});
fireButton.addEventListener('pointerdown',e=>{if(!running||paused||fireId!==null)return;audio.unlock();fireId=e.pointerId;capture(fireButton,e)});
function release(e){if(e.pointerId===moveId){moveId=null;joy={forward:0,strafe:0};knob.style.transform=''}if(e.pointerId===aimId)aimId=null;if(e.pointerId===fireId)fireId=null}for(const name of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(name,release);
document.addEventListener('keydown',e=>{if(e.target.closest?.('input,textarea,a,.modal-backdrop,#soundButton,#voiceButton'))return;const key=e.key.length===1?e.key.toLowerCase():e.key;if(['w','a','s','d',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)){e.preventDefault();if(running&&!paused)keys.add(key)}if(e.key==='Enter'&&!running&&!starting)start()});document.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
pauseControl=Arcade.installPauseControl({isRunning:()=>running,pause:()=>{paused=true;audio.suspend();resetInput();cancelAnimationFrame(raf);message.innerHTML='PAUSED<span>Tap a control to resume</span>';message.hidden=false},resume:()=>{if(!paused||!running)return;paused=false;audio.unlock();message.hidden=true;resetInput();last=performance.now();raf=requestAnimationFrame(loop)},allowWhilePaused:e=>!!e.target.closest?.('.breach-settings'),resumeOnInput:e=>e.type==='keydown'||!!e.target.closest?.('#breachControls,#game')});
// Shared mobile dock is initially inserted after the canvas; move it below the thumb controls.
let dock=document.querySelector('.earnly-session-dock');if(!dock){dock=document.createElement('div');dock.className='earnly-session-dock';dock.append(pauseControl.button,document.getElementById('earnlyQuitButton'))}document.getElementById('breachControls').insertAdjacentElement('afterend',dock);
function backgroundPause(){audio.suspend();resetInput();if(running&&!paused)pauseControl.button.click()}window.addEventListener('blur',backgroundPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)backgroundPause()});window.addEventListener('pagehide',()=>{running=false;starting=false;audio.suspend();cancelAnimationFrame(raf);resetInput()});
new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();canvas.height=Math.round(400*r.height/Math.max(1,r.width));render()}).observe(canvas);soundControls();chrome();render();
})();
