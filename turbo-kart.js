(()=>{
 'use strict';
 const E=TurboKartEngine,game='turboKart',renderer=TurboKartRenderer.create(document.getElementById('game'));
 const el=Object.fromEntries(['balance','position','lap','time','bonus','speed','gameStatus','kartMessage','kartCallout','startButton','plays','driftFill','driftLabel','leftButton','rightButton','driftButton','itemButton'].map(id=>[id,document.getElementById(id)]));
 let state=E.create(),running=false,starting=false,paused=false,disposed=false,last=0,accumulator=0,raf=0;
 const pointers=new Map(),keys=new Set();let pause;
 function controls(){const values=[...pointers.values()];return {steer:Number(values.includes('right')||keys.has('ArrowRight')||keys.has('d'))-Number(values.includes('left')||keys.has('ArrowLeft')||keys.has('a')),drift:values.includes('drift')||keys.has('Shift')};}
 function style(){const c=controls();el.leftButton.classList.toggle('held',c.steer<0);el.rightButton.classList.toggle('held',c.steer>0);el.driftButton.classList.toggle('held',c.drift);}
 function clear(){pointers.clear();keys.clear();style();}
 function chrome(){const p=state.racers[0];for(const [key,value]of Object.entries({balance:Arcade.number('points').toLocaleString(),position:state.place+' / 5',lap:Math.min(3,Math.max(1,Math.floor(p.d/E.length)+1))+' / 3',time:Math.ceil(E.LIMIT-state.time),bonus:state.coins+' / 5',speed:Math.round(p.speed*1.2)+' KM/H',plays:Arcade.remaining(game)}))el[key].textContent=value;
 el.driftFill.style.width=(state.driftCharge/1.6*100)+'%';el.driftLabel.textContent=state.driftCharge>=.7?'RELEASE DRIFT FOR A TURBO BOOST':'HOLD DRIFT + STEER, THEN RELEASE TO BOOST';el.itemButton.textContent=state.item?state.item.toUpperCase():'NO ITEM';el.itemButton.disabled=!running||paused||!state.item;el.kartCallout.hidden=!running||state.time>state.calloutUntil||!state.callout;el.kartCallout.textContent=state.callout;}
 function status(text){el.gameStatus.textContent=text;document.body.classList.toggle('game-active',running||starting);}
 function finish(){if(!running)return;running=false;paused=false;cancelAnimationFrame(raf);clear();status('Race over');el.startButton.textContent='RACE AGAIN →';el.startButton.disabled=false;el.kartMessage.hidden=false;
 const coins=E.rewards(state),metric=state.finished?state.place:0;
 if(state.finished)Arcade.earn(coins,'Turbo Kart',{kind:'game',game,metric,aux:state.coins});
 const result=Arcade.recordResult(game,E.score(state));chrome();renderer.render(state);
 Arcade.gameResult({game,icon:'🏎️',title:state.finished?['First place!','Runner-up!','On the podium!','Race complete','Race complete'][state.place-1]:'Time is up',scoreLabel:'RACE POINTS',score:E.score(state),best:Arcade.best(game).display,coins,result,playsLeft:Arcade.remaining(game),extra:[state.finished?'Finished '+state.place+' of 5 in '+state.time.toFixed(1)+'s':'Complete all 3 laps to earn Coins.',state.drifts+' drift boosts · '+state.coins+' bonus Coins collected'],onReplay:start,onMorePlays:()=>Arcade.out(game,chrome)});
 }
 function loop(now){if(!running||paused||disposed)return;accumulator+=Math.min(.1,Math.max(0,(now-last)/1000));last=now;while(accumulator>=1/60&&!state.ended){E.tick(state,1/60,controls());accumulator-=1/60;}chrome();renderer.render(state);if(state.ended){finish();return;}raf=requestAnimationFrame(loop);}
 function start(){if(running||starting||disposed)return;if(!Arcade.consume(game)){Arcade.out(game,chrome);return;}starting=true;state=E.create();clear();el.startButton.disabled=true;el.kartMessage.hidden=true;status('Starting');chrome();renderer.render(state);
 Arcade.countdown(()=>{if(disposed)return;starting=false;running=true;paused=false;last=performance.now();accumulator=0;status('Running');pause.sync();raf=requestAnimationFrame(loop);if(document.hidden)pause.button.click();});}
 el.startButton.addEventListener('click',start);
 for(const [id,value]of [['leftButton','left'],['rightButton','right'],['driftButton','drift']])el[id].addEventListener('pointerdown',e=>{if(!running||paused||e.button>0)return;e.preventDefault();el[id].setPointerCapture(e.pointerId);pointers.set(e.pointerId,value);style();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(event,e=>{pointers.delete(e.pointerId);style();});
 el.itemButton.addEventListener('click',()=>{if(running&&!paused){E.useItem(state);chrome();}});
 document.addEventListener('keydown',e=>{if(e.target.closest?.('input,textarea,dialog,.modal-backdrop'))return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowLeft','ArrowRight','a','d','Shift',' '].includes(k)){e.preventDefault();if(running&&!paused){if(k===' '&&!e.repeat){E.useItem(state);chrome();}else keys.add(k);style();}}});
 document.addEventListener('keyup',e=>{keys.delete(e.key.length===1?e.key.toLowerCase():e.key);style();});
 pause=Arcade.installPauseControl({isRunning:()=>running,pause:()=>{paused=true;cancelAnimationFrame(raf);clear();status('Paused');el.kartCallout.hidden=false;el.kartCallout.textContent='PAUSED · TAP STEER TO RESUME';},resume:()=>{if(!running||disposed)return;paused=false;clear();last=performance.now();status('Running');raf=requestAnimationFrame(loop);},resumeOnInput:e=>(e.type==='keydown'&&['ArrowLeft','ArrowRight','a','d','A','D'].includes(e.key))||!!e.target.closest?.('#leftButton,#rightButton,#driftButton')});
 let dock=document.querySelector('.earnly-session-dock');if(!dock){dock=document.createElement('div');dock.className='earnly-session-dock';dock.append(pause.button,document.getElementById('earnlyQuitButton'));}document.getElementById('sessionControls').append(dock);
 const background=()=>{clear();if(running&&!paused)pause.button.click();};window.addEventListener('blur',background);document.addEventListener('visibilitychange',()=>{if(document.hidden)background();});window.addEventListener('pagehide',()=>{disposed=true;running=false;starting=false;clear();cancelAnimationFrame(raf);});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});window.addEventListener('resize',()=>renderer.render(state,{idle:!running}));
 chrome();renderer.render(state,{idle:true});
})();
