(()=>{
 'use strict';
 const E=TurboKartEngine,game='turboKart',renderer=TurboKartRenderer.create(document.getElementById('game'));
 const el=Object.fromEntries(['balance','position','lap','time','bonus','speed','gameStatus','kartMessage','kartCallout','startButton','plays','driftFill','driftLabel','leftButton','rightButton','driftButton','itemButton','itemSlot','itemName','courseName','courseTag','courseDescription','raceProgress'].map(id=>[id,document.getElementById(id)]));
 let selectedCourse='harbor';
 let state=E.create(selectedCourse),running=false,starting=false,paused=false,disposed=false,last=0,accumulator=0,raf=0,lastHud=-Infinity,lastAccount=-Infinity;
 const pointers=new Map(),keys=new Set();let pause,drag=null,driftDrag=null;
 const canvas=document.getElementById('game');
 function controls(){const values=[...pointers.values()],buttons=Number(values.includes('right')||keys.has('ArrowRight')||keys.has('d'))-Number(values.includes('left')||keys.has('ArrowLeft')||keys.has('a'));return {steer:buttons||(drag?.steer??driftDrag?.steer??0),drift:values.includes('drift')||keys.has('Shift')};}
 function style(){const c=controls();el.leftButton.classList.toggle('held',c.steer<0);el.rightButton.classList.toggle('held',c.steer>0);el.driftButton.classList.toggle('held',c.drift);}
 function clear(){const ids=[...pointers.keys(),drag?.id];pointers.clear();keys.clear();drag=null;driftDrag=null;for(const target of [canvas,el.leftButton,el.rightButton,el.driftButton])for(const id of ids)if(id!==undefined&&target.hasPointerCapture(id))target.releasePointerCapture(id);style();}
 function setText(element,value){if(element.textContent!==String(value))element.textContent=value;}
 function chrome(){const now=performance.now();if(!running||now-lastAccount>=1000){setText(el.balance,Arcade.number('points').toLocaleString());setText(el.plays,Arcade.remaining(game));lastAccount=now;}const p=state.racers[0];for(const [key,value]of Object.entries({position:state.place+' / 5',lap:Math.min(3,Math.max(1,Math.floor(p.d/state.track.length)+1))+' / 3',time:Math.ceil(E.LIMIT-state.time),bonus:state.pickupCount,speed:Math.round(p.speed*1.2)+' KM/H'}))setText(el[key],value);
 const progress=Math.round(Math.max(0,Math.min(1,p.d/(state.track.length*3)))*100);
 el.raceProgress.style.width=progress+'%';el.raceProgress.parentElement.setAttribute('aria-valuenow',progress);
 el.raceProgress.parentElement.setAttribute('aria-valuetext',progress+'% of race completed');
 el.time.parentElement.classList.toggle('time-low',running&&E.LIMIT-state.time<=15);
 el.time.setAttribute('aria-label',Math.ceil(Math.max(0,E.LIMIT-state.time))+' seconds remaining');
 const level=E.tier(state.driftCharge);el.driftFill.style.width=((state.wasDrifting?state.driftCharge/2.5:state.draft/1.1)*100)+'%';el.driftFill.dataset.tier=level;
 setText(el.driftLabel,state.wasDrifting?(level?['','BLUE BOOST','GOLD SUPER BOOST','VIOLET ULTRA BOOST'][level]+' · RELEASE DRIFT':'CHARGING · KEEP YOUR LINE'):(state.draft>0?'SLIPSTREAM · STAY BEHIND A RIVAL':'HOLD + SLIDE DRIFT · RELEASE TO BOOST'));
 const item=E.items[state.item];setText(el.itemButton,item?item.icon+' USE ITEM':'NO ITEM');el.itemButton.disabled=!running||paused||!item;el.itemButton.setAttribute('aria-label',item?'Use '+item.name+': '+item.hint:'No item collected');setText(el.itemSlot,item?item.icon:'◇');setText(el.itemName,item?item.name:'PICK UP A GEM');
 el.kartCallout.hidden=!running||state.time>state.calloutUntil||!state.callout;setText(el.kartCallout,state.callout);}

 function status(text){el.gameStatus.textContent=text;document.body.classList.toggle('game-active',running||starting);}
 function finish(){if(!running)return;running=false;paused=false;cancelAnimationFrame(raf);clear();status('Race over');el.startButton.textContent='RACE AGAIN →';el.startButton.disabled=false;el.kartMessage.hidden=false;
 const coins=E.rewards(state),metric=state.finished?state.place:0;
 if(state.finished)Arcade.earn(coins,'Turbo Kart',{kind:'game',game,metric,aux:state.coins});
 const result=Arcade.recordResult(game,E.score(state));chrome();renderer.render(state);
 Arcade.gameResult({game,icon:'🏎️',title:state.finished?['First place!','Runner-up!','On the podium!','Race complete','Race complete'][state.place-1]:'Time is up',scoreLabel:'RACE POINTS',score:E.score(state),best:Arcade.best(game).display,coins,result,playsLeft:Arcade.remaining(game),extra:[state.finished?'Finished '+state.place+' of 5 in '+state.time.toFixed(1)+'s':'Complete all 3 laps to earn Coins.',state.drifts+' drift boosts · '+state.pickupCount+' pickups',state.coins+' / 5 bonus Arcade Coins · every pickup gives a speed surge'],onReplay:start,onMorePlays:()=>Arcade.out(game,chrome)});
 }
 function loop(now){if(!running||paused||disposed)return;accumulator+=Math.min(.1,Math.max(0,(now-last)/1000));last=now;while(accumulator>=1/60&&!state.ended){E.tick(state,1/60,controls());accumulator-=1/60;}if(now-lastHud>=100){chrome();lastHud=now;}renderer.render(state);if(state.ended){finish();return;}raf=requestAnimationFrame(loop);}
 function start(){if(running||starting||disposed)return;if(!Arcade.consume(game)){Arcade.out(game,chrome);return;}starting=true;state=E.create(selectedCourse);clear();el.startButton.disabled=true;el.kartMessage.hidden=true;status('Starting');chrome();renderer.render(state);
 Arcade.countdown(()=>{if(disposed)return;starting=false;running=true;paused=false;last=performance.now();accumulator=0;status('Running');pause.sync();raf=requestAnimationFrame(loop);if(document.hidden)pause.button.click();});}
 el.startButton.addEventListener('click',start);
 function selectCourse(id){if(running||starting)return;selectedCourse=id;state=E.create(id);el.courseName.textContent=state.track.name.toUpperCase();el.courseTag.textContent=state.track.tag;el.courseDescription.textContent=state.track.description;for(const button of document.querySelectorAll('[data-course]'))button.setAttribute('aria-pressed',String(button.dataset.course===id));chrome();renderer.render(state,{idle:true});}
 for(const button of document.querySelectorAll('[data-course]'))button.addEventListener('click',()=>selectCourse(button.dataset.course));
 canvas.addEventListener('pointerdown',e=>{if(!running||paused||drag||e.button>0)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,steer:0};});
 canvas.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;e.preventDefault();drag.steer=Math.max(-1,Math.min(1,Math.sign(e.clientX-drag.x)*Math.max(0,Math.abs(e.clientX-drag.x)-5)/Math.min(55,canvas.getBoundingClientRect().width*.16)));style();});
 // iOS callouts apply to links (including Quit) and nested labels, not just buttons.
 // Scope the guard to the racing surface so guides, dialogs and text fields stay normal.
 const surfaces=[...document.querySelectorAll('.kart-stage,.kart-hud,.drift-meter,#kartControls,#sessionControls')];
 function clearRaceSelection(){const selection=window.getSelection();if(selection?.rangeCount&&surfaces.some(surface=>surface.contains(selection.anchorNode)||surface.contains(selection.focusNode)))selection.removeAllRanges();}
 for(const surface of surfaces){for(const event of ['contextmenu','selectstart','dragstart'])surface.addEventListener(event,e=>e.preventDefault(),{capture:true});surface.addEventListener('pointerdown',clearRaceSelection,{capture:true});}
 // Guard the common race surface too: two thumbs can start on different controls
 // or their gaps. Pointer Events still own steering; click-based Pause/Quit/Item
 // retain their normal activation, and dialogs outside these surfaces are untouched.
 const raceShell=document.querySelector('.kart-shell');
 function raceTouch(e){return (running||starting)&&surfaces.some(surface=>surface.contains(e.target));}
 for(const type of ['gesturestart','gesturechange','gestureend','dblclick'])raceShell.addEventListener(type,e=>{if(raceTouch(e)&&e.cancelable)e.preventDefault();},{passive:false});
 raceShell.addEventListener('touchmove',e=>{if(raceTouch(e)&&e.cancelable)e.preventDefault();},{passive:false});
 for(const type of ['touchstart','touchend'])raceShell.addEventListener(type,e=>{
  if(!raceTouch(e)||!e.cancelable)return;
  // These controls are pointer-driven, so suppress Safari's synthetic double-tap.
  // Non-actionable gaps also need protection, including the disabled item button.
  const action=e.target.closest?.('button,a');
  if(!action||action.disabled||action.matches('#leftButton,#rightButton,#driftButton'))e.preventDefault();
 },{passive:false});
 for(const [id,value]of [['leftButton','left'],['rightButton','right'],['driftButton','drift']])el[id].addEventListener('pointerdown',e=>{if(!running||paused||e.button>0||[...pointers.values()].includes(value))return;e.preventDefault();el[id].setPointerCapture(e.pointerId);pointers.set(e.pointerId,value);if(value==='drift'&&!driftDrag)driftDrag={id:e.pointerId,x:e.clientX,steer:0};style();});
 el.driftButton.addEventListener('pointermove',e=>{if(driftDrag?.id!==e.pointerId)return;e.preventDefault();const distance=e.clientX-driftDrag.x;driftDrag.steer=Math.sign(distance)*Math.min(1,Math.max(0,Math.abs(distance)-6)/48);style();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(event,e=>{pointers.delete(e.pointerId);if(drag?.id===e.pointerId)drag=null;if(driftDrag?.id===e.pointerId)driftDrag=null;style();});
 el.itemButton.addEventListener('click',()=>{if(running&&!paused){E.useItem(state);chrome();}});
 document.addEventListener('keydown',e=>{if(e.target.closest?.('input,textarea,dialog,.modal-backdrop'))return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowLeft','ArrowRight','a','d','Shift',' '].includes(k)){e.preventDefault();if(running&&!paused){if(k===' '&&!e.repeat){E.useItem(state);chrome();}else keys.add(k);style();}}});
 document.addEventListener('keyup',e=>{keys.delete(e.key.length===1?e.key.toLowerCase():e.key);style();});
 pause=Arcade.installPauseControl({isRunning:()=>running,pause:()=>{paused=true;cancelAnimationFrame(raf);clear();status('Paused');el.kartCallout.hidden=false;el.kartCallout.textContent='PAUSED · TAP STEER TO RESUME';},resume:()=>{if(!running||disposed)return;paused=false;clear();last=performance.now();status('Running');raf=requestAnimationFrame(loop);},resumeOnInput:e=>(e.type==='keydown'&&['ArrowLeft','ArrowRight','a','d','A','D'].includes(e.key))||!!e.target.closest?.('#leftButton,#rightButton,#driftButton,#game')});
 let dock=document.querySelector('.earnly-session-dock');if(!dock){dock=document.createElement('div');dock.className='earnly-session-dock';dock.append(pause.button,document.getElementById('earnlyQuitButton'));}document.getElementById('sessionControls').append(dock);
 const background=()=>{clear();if(running&&!paused)pause.button.click();};window.addEventListener('blur',background);document.addEventListener('visibilitychange',()=>{if(document.hidden)background();});window.addEventListener('pagehide',()=>{disposed=true;running=false;starting=false;clear();cancelAnimationFrame(raf);});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});window.addEventListener('resize',()=>renderer.render(state,{idle:!running}));
 // Read-only profile loading. Never persist a loadout across account changes.
 let driverVersion=0;
 async function loadDriver(){const version=++driverVersion;renderer.setDriver(null);
  let equipped=TurboKartDriver.defaults;
  try{const session=await window.EarnlyCloud?.session();if(session){const response=await fetch('https://zdwziebtbpuolusztede.supabase.co/functions/v1/avatars/api/me',{headers:{Authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(8000)});if(response.ok){const data=await response.json();equipped=data.user?.equipped||equipped;}}}catch{}
  const driver=await TurboKartDriver.compose(equipped);if(version!==driverVersion||disposed)return;renderer.setDriver(driver);if(!running||paused)renderer.render(state,{idle:!running});
 }
 for(const event of ['earnly-cloud-ready','earnly-cloud-auth-change','earnly-public-profile-updated'])window.addEventListener(event,loadDriver);
 loadDriver();
 chrome();renderer.render(state,{idle:true});
 // Only accept a start after the renderer and input handlers are ready.
 status('Ready');el.startButton.textContent='START RACE →';el.startButton.disabled=false;
})();
