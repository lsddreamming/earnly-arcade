(()=>{
  'use strict';
  const E=NeonDriftEngine,game='neonDrift',canvas=document.getElementById('game'),renderer=NeonDriftRenderer.create(canvas),audio=NeonDriftAudio;
  const ids=['score','hull','time','plays','balance','speed','combo','driftState','gameStatus','startButton','driftMessage','driftCallout','leftButton','rightButton','soundButton','sectorProgress','runCoins','pickupStreak','sectorBar'];
  const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
  function newState(){const s=E.create();s.paintSector=Math.max(Arcade.number('arcadeNeonDriftTopSector'),Arcade.number('arcadeDodgerTopLevel'));return s;}
  let state=newState(),running=false,starting=false,paused=false,disposed=false,last=0,raf=0,calloutUntil=0,settleTimer=0;
  const pointers=new Map(),keys=new Set();let pauseControl;
  const steering=()=>Math.max(-1,Math.min(1,[...pointers.values()].reduce((a,b)=>a+b,0)+(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0)));
  function inputStyle(){const n=steering();el.leftButton.classList.toggle('held',n<0);el.rightButton.classList.toggle('held',n>0);}
  function resetInput(){pointers.clear();keys.clear();inputStyle();}
  function chrome(){
    const values={score:state.score,hull:state.hull,time:Math.ceil(E.DURATION-state.time),plays:Arcade.remaining(game),balance:Arcade.number('points').toLocaleString(),speed:running?Math.round(E.difficulty(state.time).speed*.65):0,combo:'×'+state.combo,driftState:running?(state.boost>0?'OVERDRIVE':Math.abs(state.vx)>48?'DRIFTING':'SECTOR 0'+state.stage):'MIDNIGHT CIRCUIT'};
    values.sectorProgress=running?'SECTOR 0'+state.stage+' / 06 · '+Math.ceil(E.SECTOR_SECONDS-state.time%E.SECTOR_SECONDS)+'s':('BEST SECTOR '+Math.max(1,Arcade.number('arcadeNeonDriftTopSector'))+' · '+(Math.max(state.stage,state.paintSector)>=5?'GOLD CAR':Math.max(state.stage,state.paintSector)>=3?'VIOLET CAR':'CYAN CAR'));values.runCoins=E.rewards(state).total+' Coins';values.pickupStreak=state.boost>0?'⚡ OVERDRIVE':'⚡ '+state.coreStreak+' / 5';el.sectorBar.style.width=(state.time%E.SECTOR_SECONDS/E.SECTOR_SECONDS*100)+'%';
    for(const [key,value]of Object.entries(values))if(el[key].textContent!==String(value))el[key].textContent=value;
  }
  function soundControl(){const on=Arcade.soundEnabled();el.soundButton.textContent=on?'♫ On':'♫ Off';el.soundButton.setAttribute('aria-pressed',String(on));el.soundButton.setAttribute('aria-label',on?'Mute sound effects':'Enable sound effects');}
  el.soundButton.addEventListener('click',()=>{localStorage.setItem('arcadeSound',Arcade.soundEnabled()?'off':'on');if(Arcade.soundEnabled()&&!paused)audio.unlock();else audio.suspend();soundControl();});
  function status(text,active){el.gameStatus.textContent=text;el.gameStatus.classList.toggle('running',active);document.body.classList.toggle('game-active',active);}
  function message(title,subtitle){el.driftMessage.innerHTML='<strong>'+title+'</strong><span>'+subtitle+'</span>';el.driftMessage.hidden=false;}
  function finish(){
    if(!running)return;audio.stop();audio.effect(state.time>=E.DURATION?'complete':'end');clearTimeout(settleTimer);settleTimer=setTimeout(()=>{if(!running&&!starting)audio.suspend();},1100);running=false;paused=false;cancelAnimationFrame(raf);resetInput();status('Run Over',false);el.driftCallout.hidden=true;el.driftMessage.hidden=true;
    const reward=E.rewards(state),coins=reward.total;let result={};
    localStorage.setItem('arcadeNeonDriftTopSector',String(Math.max(state.stage,Arcade.number('arcadeNeonDriftTopSector'))));
    try{Arcade.earn(coins,'Neon Drift',{kind:'game',game,metric:state.score});}catch(err){console.error('Drift reward save failed',err);}
    try{result=Arcade.recordResult(game,state.score)||{};}catch(err){console.error('Drift result save failed',err);}
    chrome();
    Arcade.gameResult({game,icon:'🏁',title:state.time>=E.DURATION?'Midnight Run Complete':'Neon Drift Run Over',scoreLabel:'POINTS',score:state.score,best:Arcade.best(game).display,coins,result,playsLeft:Arcade.remaining(game),extra:['🪙 Score Coins: '+reward.base+' · Bonus Coins: '+reward.bonus,'⚡ Pickups: '+state.cores+' · Clean sectors: '+state.cleanSectors,'🏁 Sector reached: '+state.stage+' / 6','🏁 Near misses: '+state.nearMisses,'⚡ Best combo: ×'+state.bestCombo,'↗ Drift time: '+Math.floor(state.drift)+'s','⏱️ Time played: '+Math.round(state.time)+'s'],onReplay:start,onMorePlays:()=>Arcade.out(game,chrome)});
    // The shared dialog can be dismissed; keep an explicit replay button behind it.
    message('RUN COMPLETE','One more midnight run?');const replay=document.createElement('button');replay.id='startButton';replay.textContent='▶ PLAY AGAIN';replay.type='button';replay.addEventListener('click',start);el.driftMessage.append(replay);el.startButton=replay;
  }
  function loop(now){
    if(!running||paused||disposed)return;
    const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;E.tick(state,dt,steering());
    audio.drive(state.hurt===0?Math.max(0,(Math.abs(state.vx)-40)/165):0,(E.difficulty(state.time).speed-350)/290,state.boost>0);
    for(const event of state.events){renderer.event(event,state);audio.effect(event.type,event.combo);if(event.type==='near'){el.driftCallout.textContent='CLOSE CALL ×'+event.combo+' · +'+(60*event.combo);}else if(event.type==='crash'){el.driftCallout.textContent=state.hull?'HIT · '+state.hull+' HULL LEFT':'WRECKED';}else if(event.type==='stage'){el.driftCallout.textContent='SECTOR 0'+event.stage+(event.bonus?' · +'+event.bonus+' BONUS COINS':' · FASTER TRAFFIC');}else if(event.type==='pickup'){el.driftCallout.textContent='+1 BONUS COIN · '+event.streak+'/5';}else if(event.type==='boost'){el.driftCallout.textContent='⚡ OVERDRIVE · +2 BONUS COINS';}else continue;el.driftCallout.hidden=false;calloutUntil=state.time+1.2;}
    state.events.length=0;if(state.time>calloutUntil)el.driftCallout.hidden=true;chrome();renderer.render(state,{dt});
    if(state.ended){finish();return;}raf=requestAnimationFrame(loop);
  }
  function start(){
    if(running||starting||disposed)return;if(!Arcade.consume(game)){Arcade.out(game,chrome);return;}
    starting=true;clearTimeout(settleTimer);audio.stop();audio.unlock().then(ok=>{if(ok&&starting&&!disposed&&!document.hidden)audio.effect('start');});renderer.reset();el.startButton.disabled=true;resetInput();state=newState();el.driftMessage.hidden=true;el.driftCallout.hidden=true;chrome();renderer.render(state);
    Arcade.countdown(()=>{if(disposed)return;starting=false;running=true;paused=false;status('Running',true);chrome();pauseControl.sync();last=performance.now();raf=requestAnimationFrame(loop);if(document.hidden)pauseControl.button.click();});
  }
  el.startButton.addEventListener('click',start);
  for(const [button,value]of [[el.leftButton,-1],[el.rightButton,1],[canvas,0]]){
    button.addEventListener('pointerdown',e=>{if(!running||paused||disposed||e.button>0)return;e.preventDefault();button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,value|| (e.clientX<button.getBoundingClientRect().left+button.clientWidth/2?-1:1));inputStyle();});
    if(button===canvas)button.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!running||paused)return;const r=canvas.getBoundingClientRect();pointers.set(e.pointerId,e.clientX<r.left+r.width/2?-1:1);inputStyle();});
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>{pointers.delete(e.pointerId);inputStyle();});
  document.addEventListener('keydown',e=>{if(e.target.closest?.('input,textarea,a,.modal-backdrop,dialog,#soundButton'))return;const key=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowLeft','ArrowRight','a','d'].includes(key)){e.preventDefault();if(running&&!paused){keys.add(key);inputStyle();}}if(key==='Enter'&&!running&&!starting)start();});
  document.addEventListener('keyup',e=>{keys.delete(e.key.length===1?e.key.toLowerCase():e.key);inputStyle();});
  pauseControl=Arcade.installPauseControl({isRunning:()=>running,pause:()=>{paused=true;audio.suspend();cancelAnimationFrame(raf);resetInput();message('PAUSED','Tap a drift control to resume');},resume:()=>{if(!paused||!running||disposed)return;paused=false;audio.unlock();el.driftMessage.hidden=true;resetInput();last=performance.now();raf=requestAnimationFrame(loop);},allowWhilePaused:e=>!!e.target.closest?.('#soundButton'),resumeOnInput:e=>(e.type==='keydown'&&['ArrowLeft','ArrowRight','a','d','A','D'].includes(e.key))||!!e.target.closest?.('#driftControls,#game')});
  let dock=document.querySelector('.earnly-session-dock');if(!dock){dock=document.createElement('div');dock.className='earnly-session-dock';dock.append(pauseControl.button,document.getElementById('earnlyQuitButton'));}document.getElementById('driftControls').insertAdjacentElement('afterend',dock);
  const background=()=>{audio.suspend();resetInput();if(running&&!paused)pauseControl.button.click();};window.addEventListener('blur',background);document.addEventListener('visibilitychange',()=>{if(document.hidden)background();});window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(settleTimer);audio.suspend();running=false;starting=false;resetInput();cancelAnimationFrame(raf);});
  // bfcache restores must reinitialize the shared lifecycle listeners as well.
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  soundControl();chrome();renderer.render(state,{idle:true});
})();
