(function(){
 'use strict';
 const E=TrafficEscapeEngine;
 function goal(score){return [6,13,21,30,39,49,59].find(n=>n>score)||59;}
 function vehicle(c){
  const w=c.len*52,color=['#56aaf3','#f3bc67','#b69bec','#6bcdaa','#f38a9e','#8cc8dc'][c.id%6];
  const turn=c.h?'':`translate(52 0) rotate(90)`;
  const flip=c.dir<0?`translate(${w} 52) rotate(180)`:'';
  return `<svg viewBox="0 0 ${c.h?w:52} ${c.h?52:w}" aria-hidden="true"><g transform="${turn}"><g transform="${flip}"><rect x="12" y="3" width="17" height="46" rx="5" fill="#081827"/><rect x="${w-31}" y="3" width="17" height="46" rx="5" fill="#081827"/><rect x="3" y="7" width="${w-6}" height="39" rx="11" fill="#0005" transform="translate(0 3)"/><rect x="3" y="5" width="${w-6}" height="39" rx="11" fill="${color}" stroke="#fff8"/><path d="M${w-30} 10h13q6 0 6 6v16q0 6-6 6h-13zM17 11h12v26H17z" fill="#173e58" stroke="#d1f5ff88"/><path d="M${w-27} 12h9v23" fill="none" stroke="#c9f7ff66" stroke-width="3"/><rect x="7" y="13" width="3" height="7" rx="1" fill="#ff697b"/><rect x="7" y="30" width="3" height="7" rx="1" fill="#ff697b"/><rect x="${w-8}" y="12" width="4" height="8" rx="2" fill="#fff3bf"/><rect x="${w-8}" y="29" width="4" height="8" rx="2" fill="#fff3bf"/><path d="M${w/2-13} 25h25m-8-8 8 8-8 8" fill="none" stroke="#11304b" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M${w/2-13} 25h25m-8-8 8 8-8 8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g></g></svg>`;
 }
 function idle(){return '<div class="traffic-idle"><div class="traffic-idle-city" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="traffic-idle-road" aria-hidden="true">'+vehicle({id:0,h:true,len:2,dir:1})+vehicle({id:1,h:true,len:2,dir:-1})+'</div><div class="traffic-idle-copy"><span>CITY ESCAPE</span><strong>Untangle the rush.</strong><p>Read the arrows. Find the exit.<br>Seven districts. Three chances.</p><small>Tap a car when its entire path is clear</small></div></div>';}
 function create({surface,ui,finish,isPaused}){
  const game=E.create(),s=game.state,oldBest=Number(Arcade.best('trafficEscape')?.value)||0;
  const wrap=document.createElement('div');wrap.className='traffic-wrap';
  wrap.innerHTML='<div class="traffic-district"><span class="traffic-district-name"></span><span class="traffic-lives" aria-label="Lives remaining"></span></div><div class="traffic-route" aria-label="Seven city districts"></div><div class="traffic-clock-row"><strong class="traffic-clock-label"></strong><span class="traffic-remaining"></span></div><progress class="traffic-clock" aria-label="Road time remaining" max="1" value="1"></progress><div class="traffic-board-frame"><div class="traffic-road-edge traffic-north" aria-hidden="true">EXIT ↑</div><div class="traffic-grid" role="group" aria-label="Traffic puzzle"></div><div class="traffic-road-edge traffic-south" aria-hidden="true">↓ EXIT</div><div class="traffic-level-card" hidden><span>DISTRICT CLEAR</span><strong></strong><small></small></div></div><div class="traffic-level-line" role="status" aria-live="polite">Follow the arrows. Clear the whole path.</div><div class="traffic-goals"><span class="traffic-chain"></span><span class="traffic-best"></span></div>';
  surface.replaceChildren(wrap);
  const grid=wrap.querySelector('.traffic-grid'),name=wrap.querySelector('.traffic-district-name'),lives=wrap.querySelector('.traffic-lives'),route=wrap.querySelector('.traffic-route'),clock=wrap.querySelector('progress'),time=wrap.querySelector('.traffic-clock-label'),left=wrap.querySelector('.traffic-remaining'),line=wrap.querySelector('.traffic-level-line'),card=wrap.querySelector('.traffic-level-card'),chain=wrap.querySelector('.traffic-chain'),best=wrap.querySelector('.traffic-best');
  const dock=document.createElement('div');dock.className='traffic-session-controls';surface.after(dock);const parked=[];
  for(const id of ['earnlyPauseButton','earnlyQuitButton']){const button=document.getElementById(id);if(button){const marker=document.createComment('traffic control home');button.before(marker);parked.push({button,marker});dock.append(button);}}
  let alive=false,ended=false,raf=null,last=null,lastHud='',lastTime='',cueUntil=0,pbShown=false;
  function cue(text,seconds=1){line.textContent=text;cueUntil=s.time+seconds;}
  function renderBoard(){
   grid.replaceChildren();
   for(const c of s.cars){
    const b=document.createElement('button');b.className='traffic-car';b.type='button';b.dataset.car=String(c.id);
    b.style.cssText=`left:${c.x/6*100+.6}%;top:${c.y/6*100+.6}%;width:${(c.h?c.len:1)/6*100-1.2}%;height:${(c.h?1:c.len)/6*100-1.2}%;--exit-x:${c.h?c.dir*720:0}%;--exit-y:${c.h?0:c.dir*720}%;`;
    b.addEventListener('keydown',e=>{if(e.repeat&&(e.key==='Enter'||e.code==='Space'))e.preventDefault();});
    b.innerHTML=vehicle(c);b.setAttribute('aria-label','Car '+(c.id+1)+' pointing '+(c.h?(c.dir>0?'right':'left'):(c.dir>0?'down':'up')));
    // Keep geometry readable to assistive technology without advertising which
    // car is safe. Neither styling nor labels reveal the solver's answer.
    b.addEventListener('click',e=>{if(!alive||isPaused()||e.button>0)return;sync(performance.now());if(!alive)return;game.tap(c.id);events(game.takeEvents());update();});
    grid.append(b);
   }
  }
  function update(){
   const hud=[s.cleared,s.level,s.strikes,s.phase,s.streak].join(':');
   if(hud!==lastHud){lastHud=hud;ui(s.cleared,s.level);name.textContent=E.districts[s.level-1];surface.style.setProperty('--traffic-accent',E.colors[s.level-1]);lives.textContent='♥ '.repeat(3-s.strikes)+'♡ '.repeat(s.strikes);lives.setAttribute('aria-label',(3-s.strikes)+' lives remaining');route.innerHTML=E.districts.map((d,i)=>'<span class="'+(i<s.roads?'done':i===s.level-1?'current':'')+'" aria-label="'+d+(i<s.roads?' cleared':i===s.level-1?' current':' upcoming')+'">'+(i<s.roads?'✓':i+1)+'</span>').join('');left.textContent=s.cars.length+' CARS LEFT';chain.textContent='CLEAN CHAIN · '+s.streak;best.textContent=oldBest>s.cleared?'BEST · '+oldBest+' / GOAL · '+goal(s.cleared):'NEXT GOAL · '+goal(s.cleared);wrap.dataset.phase=s.phase;wrap.dataset.level=String(s.level);wrap.classList.toggle('traffic-rush',s.streak>=5);}
   const text=s.remaining.toFixed(1)+'s';if(text!==lastTime){lastTime=text;time.textContent=text;clock.value=s.remaining/E.LIMITS[s.level-1];wrap.classList.toggle('traffic-urgent',s.remaining<=4&&s.phase!=='transition');}
   if(s.time>=cueUntil&&s.phase==='play'){const text='Follow the arrows. Clear the whole path.';if(line.textContent!==text)line.textContent=text;}
  }
  function complete(){
   if(ended)return;ended=true;
   const medals=[];if(s.roads>=1)medals.push('First district');if(s.bestStreak>=15)medals.push('Clean chain 15');if(s.cleanRoads>=3)medals.push('Three clean roads');if(s.roads===7)medals.push('City master');
   finish(s.cleared,s.level,['🚦 Districts cleared: '+s.roads+'/7','✨ Clean roads: '+s.cleanRoads,'🔥 Best clean chain: '+s.bestStreak,'⚡ Fast roads: '+s.fastClears,'🏁 Best road: '+(s.bestRoadTime===null?'—':s.bestRoadTime.toFixed(1)+'s'),'💥 Blocked taps: '+s.strikes+'/3',...(medals.length?['🏅 Run medals: '+medals.join(' · ')]:[])],s.reason==='complete'?'Traffic Master':s.reason==='timeout'?'Traffic Escape — Time Up':'Traffic Escape',s.reason==='complete'?'CITY MASTER':s.reason==='timeout'?'TIME EXPIRED':'3 CRASHES — RUN OVER');
  }
  function events(list){
   for(const e of list){
    if(e.type==='road'){card.hidden=true;renderBoard();cue('DISTRICT '+s.level+' · '+E.districts[s.level-1],1.2);}
    if(e.type==='exit'){const b=grid.querySelector('[data-car="'+e.id+'"]');b?.classList.add('escaping');Arcade.feedback('score');}
    if(e.type==='blocked'){const b=grid.querySelector('[data-car="'+e.id+'"]');if(b){b.classList.remove('blocked');void b.offsetWidth;b.classList.add('blocked');}cue('BLOCKED PATH · '+(3-s.strikes)+' chances left',1.1);Arcade.feedback('fail');}
    if(e.type==='score'){grid.querySelector('[data-car="'+e.id+'"]')?.remove();if(s.streak>0&&s.streak%5===0){cue('CLEAN CHAIN · '+s.streak,1.2);Arcade.feedback('perfect');}if(oldBest>0&&s.cleared>oldBest&&!pbShown){pbShown=true;cue('NEW PERSONAL BEST!',1.5);}}
    if(e.type==='clear'){card.hidden=false;card.querySelector('strong').textContent=e.clean?'CLEAN SWEEP!':'ROAD CLEARED!';card.querySelector('small').textContent=e.seconds.toFixed(1)+'s · '+(e.quick?'Fast road · ':'')+(e.level<7?'District '+(e.level+1)+' next':'Every district cleared');cue('DISTRICT '+e.level+' CLEARED',1);Arcade.feedback('perfect');}
    if(e.type==='over'){complete();return;}
   }
  }
  function sync(t){const dt=last===null?0:Math.max(0,(t-last)/1000);last=t;if(!isPaused())events(game.advance(dt));}
  function loop(t){if(!alive)return;sync(t);if(!alive)return;update();raf=requestAnimationFrame(loop);}
  return {start(){alive=true;events(game.start());last=performance.now();update();raf=requestAnimationFrame(loop);},adjustPauseTime(){last=performance.now();},stop(){alive=false;cancelAnimationFrame(raf);for(const {button,marker} of parked)marker.replaceWith(button);dock.remove();}};
 }
 window.TrafficEscapeGame={create,idle,goal};
})();
