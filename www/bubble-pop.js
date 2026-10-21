(()=>{'use strict';
 const E=BubblePopEngine,$=id=>document.getElementById(id),canvas=$('board'),ctx=canvas.getContext('2d');
 const palette=['#ff729c','#73aaff','#ffcf63','#6ce5bf'],symbols=['♥','◆','✿','●'],names=['pink','blue','yellow','green'];
 let savedLevel=0,best=0;
 try{savedLevel=Number(localStorage.getItem('earnlyBubblePopLevel'))||0;best=Number(localStorage.getItem('earnlyBubblePopPreviewBest'))||0;}catch{}
 const game=E.create(Math.random,savedLevel),media=matchMedia('(prefers-reduced-motion: reduce)');
 let started=false,paused=false,busy=false,selected=0,sound=false,audio=null,raf=0,timer=0,w=420,h=480,transition=null,modal='start',returnFocus=null;
 const save=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};
 function geometry(){const size=Math.min((w-12)/E.COLS,(h-12)/E.ROWS);return {size,x:(w-size*E.COLS)/2,y:(h-size*E.ROWS)/2};}
 function star(x,y,r){ctx.beginPath();for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,rr=k%2?r*.45:r;ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}ctx.closePath();ctx.fill();}
 function bubble(c,x,y,r,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;
  if(c.star){ctx.fillStyle='#634327';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffe18b';star(x,y,r*.84);ctx.fillStyle='#fff7d5';star(x-r*.15,y-r*.15,r*.28);ctx.restore();return;}
  ctx.fillStyle='#05091c';ctx.beginPath();ctx.arc(x,y+3,r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=c.power?(c.power==='bomb'?'#d5b8ff':'#f8f3ff'):palette[c.color];ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffffff75';ctx.beginPath();ctx.ellipse(x-r*.3,y-r*.4,r*.28,r*.14,-.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#18243e';ctx.textAlign='center';ctx.textBaseline='middle';
  if(c.power==='bomb'){
   ctx.fillStyle='#493064';ctx.beginPath();ctx.arc(x,y+2,r*.43,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#493064';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-r*.25);ctx.quadraticCurveTo(x+r*.1,y-r*.75,x+r*.45,y-r*.5);ctx.stroke();ctx.fillStyle='#fff4a4';star(x+r*.47,y-r*.49,r*.18);
  }else if(c.power){
   ctx.translate(x,y);if(c.power==='vertical')ctx.rotate(Math.PI/2);ctx.fillStyle='#6453ac';ctx.fillRect(-r*.4,-r*.15,r*.8,r*.3);ctx.beginPath();ctx.moveTo(-r*.7,0);ctx.lineTo(-r*.25,-r*.4);ctx.lineTo(-r*.25,r*.4);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(r*.7,0);ctx.lineTo(r*.25,-r*.4);ctx.lineTo(r*.25,r*.4);ctx.closePath();ctx.fill();
  }else{ctx.font=`800 ${r*.87}px system-ui`;ctx.fillText(symbols[c.color],x,y+1);}
  ctx.restore();
 }
 function iceTiles(ice,g){ice.forEach((f,i)=>{if(!f)return;const x=g.x+(i%E.COLS)*g.size+2,y=g.y+Math.floor(i/E.COLS)*g.size+2;ctx.fillStyle='#83e9ff24';ctx.fillRect(x,y,g.size-4,g.size-4);ctx.strokeStyle='#9be9ffb8';ctx.lineWidth=1.5;ctx.strokeRect(x+1,y+1,g.size-6,g.size-6);ctx.beginPath();ctx.moveTo(x+4,y+g.size*.3);ctx.lineTo(x+g.size*.3,y+4);ctx.stroke();});}
 function draw(){
  if(raf){cancelAnimationFrame(raf);raf=0;}
  ctx.clearRect(0,0,w,h);const s=game.state(),g=geometry(),now=performance.now(),t=transition?Math.min(1,(now-transition.start)/400):1;
  const center=i=>({x:g.x+(i%E.COLS+.5)*g.size,y:g.y+(Math.floor(i/E.COLS)+.5)*g.size});
  iceTiles(transition&&t<.3?transition.oldIce:s.ice,g);
  if(transition&&t<.3){
   transition.old.forEach((c,i)=>{const p=center(i),pop=transition.cleared.includes(i);bubble(c,p.x,p.y,g.size*.405*(pop?1-t*2:1),pop?1-t*3:1);});
  }else{
   const progress=transition?1-Math.pow(1-Math.min(1,(t-.3)/.7),3):1;
   s.board.forEach((c,i)=>{const p=center(i),fall=transition?.falls[i];let y=p.y;if(fall)y=g.y+(.5+fall.from+(fall.to-fall.from)*progress)*g.size;bubble(c,p.x,y,g.size*.405);});
  }
  if(!transition){
   s.board.forEach((c,i)=>{if(!c.power)return;for(const n of E.neighbors(i))if(n>i&&s.board[n].power){const a=center(i),b=center(n);ctx.strokeStyle='#f8d983';ctx.lineWidth=3;ctx.beginPath();const dx=(b.x-a.x)*.43,dy=(b.y-a.y)*.43;ctx.moveTo(a.x+dx,a.y+dy);ctx.lineTo(b.x-dx,b.y-dy);ctx.stroke();}});
   if(canvas===document.activeElement){const p=center(selected);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,g.size*.46,0,Math.PI*2);ctx.stroke();}
  }
  if(transition){
   ctx.save();ctx.globalAlpha=Math.max(0,1-t);
   for(const i of transition.cleared){const p=center(i);ctx.strokeStyle=palette[transition.old[i].color]||'#dfc6ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,g.size*(.25+t*.5),0,Math.PI*2);ctx.stroke();}
   for(const blast of transition.blasts){const p=center(blast.index);ctx.strokeStyle='#fff0ad';ctx.lineWidth=g.size*(blast.type==='rocket-bomb'?.65:.2)*(1-t);ctx.beginPath();
    if(blast.type.includes('bomb')&&blast.type!=='rocket-bomb'){ctx.arc(p.x,p.y,g.size*(blast.type==='double-bomb'?3:1.7)*t,0,Math.PI*2);}else{
     if(blast.type!=='vertical'){ctx.moveTo(g.x,p.y);ctx.lineTo(w-g.x,p.y);}
     if(blast.type!=='horizontal'){ctx.moveTo(p.x,g.y);ctx.lineTo(p.x,h-g.y);}
    }ctx.stroke();
   }
   for(const drop of transition.starDrops){const p=center(drop.index);ctx.fillStyle='#ffe18b';star(p.x,p.y+(h-p.y)*t,g.size*.34);}
   ctx.restore();if(t<1&&!media.matches&&!document.hidden)raf=requestAnimationFrame(draw);
  }
 }
 function layout(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();}
 function goalText(s){const g=s.goals,parts=[];if(g.collect)parts.push(`collect ${g.collect} ${names[g.color]} bubbles`);if(g.ice)parts.push(`break ${g.ice} ice tiles`);if(g.stars)parts.push(`drop ${g.stars} gold stars`);return parts.join(' · ');}
 function tip(s){return s.goals.stars?'Pop below gold stars to drop them to the bottom.':s.goals.ice?'Pop bubbles on icy tiles to break the ice.':'Match 5 for a rocket. Match 7 for a bomb.';}
 function update(){
  const s=game.state(),g=s.goals;$('score').textContent=s.score.toLocaleString();$('moves').textContent=s.moves;$('moves').classList.toggle('urgent',s.moves<=5);$('best').textContent=best.toLocaleString();$('levelLabel').textContent=`LEVEL ${s.level+1} / ${s.levelCount}`;$('levelName').textContent=s.name;$('goalHint').textContent=g.stars?'Pop below gold stars ↓':g.ice?'Pop bubbles on ice':'Collect '+names[g.color]+' bubbles';$('combo').textContent=s.combo>1?'COMBO ×'+Math.min(4,1+Math.floor(s.combo/2)):'GO BIG';
  const goals=[];if(g.collect)goals.push({symbol:symbols[g.color],color:palette[g.color],label:names[g.color],n:g.collected,total:g.collect});if(g.ice)goals.push({symbol:'❄',color:'#9ce8ff',label:'ice',n:g.ice-g.iceLeft,total:g.ice});if(g.stars)goals.push({symbol:'★',color:'#ffe18b',label:'stars',n:g.delivered,total:g.stars});
  $('goals').replaceChildren(...goals.map(goal=>{const el=document.createElement('div');el.className='goal'+(goal.n>=goal.total?' done':'');el.setAttribute('aria-label',`${goal.label}: ${Math.min(goal.n,goal.total)} of ${goal.total}`);const fill=document.createElement('span');fill.className='goal-fill';fill.style.width=Math.min(100,goal.n/goal.total*100)+'%';const label=document.createElement('span');label.className='goal-label';const name=document.createElement('span');name.textContent=goal.symbol+' '+goal.label;name.style.setProperty('--goal-color',goal.color);name.className='goal-symbol';const count=document.createElement('b');count.textContent=goal.n>=goal.total?'✓':goal.n+'/'+goal.total;label.append(name,count);el.append(fill,label);return el;}));
 }
 function tone(kind,count=2){
  if(!sound||document.hidden)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();audio.resume();const notes=kind==='win'?[523,659,784,1047]:kind==='blast'?[120,240,480]:[380+Math.min(count,12)*25,620+Math.min(count,12)*25];notes.forEach((freq,i)=>{const o=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+i*.055;o.type=kind==='blast'?'triangle':'sine';o.frequency.setValueAtTime(freq,start);o.frequency.exponentialRampToValueAtTime(freq*1.3,start+.12);gain.gain.setValueAtTime(.045,start);gain.gain.exponentialRampToValueAtTime(.001,start+.18);o.connect(gain);gain.connect(audio.destination);o.start(start);o.stop(start+.2);o.onended=()=>{o.disconnect();gain.disconnect();};});}catch{}
 }
 function overlay(mode,title,text,button,extra=''){
  modal=mode;returnFocus=document.activeElement;$('overlayTag').textContent=`LEVEL ${game.state().level+1} · ${game.state().name.toUpperCase()}`;$('resultTitle').textContent=title;$('resultText').textContent=text;$('play').textContent=button;$('overlayTip').textContent=extra;$('cancel').hidden=!['restart','quit'].includes(mode);$('overlay').hidden=false;
 }
 function end(){
  started=false;paused=false;const s=game.state();if(s.score>best){best=s.score;save('earnlyBubblePopPreviewBest',best);}update();$('pause').disabled=true;$('restart').disabled=true;
  if(s.status==='won'){
   tone('win');const last=s.level===s.levelCount-1;save('earnlyBubblePopLevel',last?0:s.level+1);
   overlay(last?'complete':'won',last?'All six cleared!':'Level cleared!',`${s.score.toLocaleString()} points · ${s.moves} moves to spare`,last?'Play from level 1 →':'Next level →',last?'Try building bigger power-up combos on your next run.':`Next: ${E.LEVELS[s.level+1].name}`);
  }else overlay('lost','So close!',goalText(s)+'.','Try this level again →','Aim at the goals. Save touching power-ups for a bigger blast.');
  $('play').focus({preventScroll:true});
 }
 function settle(){clearTimeout(timer);timer=0;cancelAnimationFrame(raf);raf=0;transition=null;busy=false;draw();if(started&&game.state().done)end();}
 function act(i){
  if(!started||paused||busy)return;const result=game.pop(i);
  if(!result.valid){$('feedback').textContent=game.state().board[i]?.star?'Pop below the gold star ↓':'Find 2+ of the same color';return;}
  busy=true;selected=i;
  const labels={'double-bomb':'MEGA BLAST!','double-rocket':'CROSS BLAST!','rocket-bomb':'ROCKET STORM!'};
  $('feedback').textContent=(labels[result.powerCombo]|| (result.starDrops.length?'Star delivered!':result.createdPower==='bomb'?'Bomb ready!':result.createdPower?'Rocket ready!':result.detonated?'Chain blast!':result.iceBroken?'Ice cracked!':'Pop!'))+' +'+result.points.toLocaleString();
  if(result.rearranged)$('feedback').textContent+=' · Fresh match';
  tone(result.detonated?'blast':'pop',result.count);update();
  // Falls are keyed to final board indices, not array traversal order.
  result.falls.sort((a,b)=>(a.to*E.COLS+a.column)-(b.to*E.COLS+b.column));
  transition=media.matches?null:{...result,start:performance.now()};draw();timer=setTimeout(settle,media.matches?0:400);
 }
 function begin(kind){
  clearTimeout(timer);cancelAnimationFrame(raf);transition=null;busy=false;paused=false;
  if(kind==='won')game.next();else if(kind==='complete')game.reset(0);else if(kind==='lost'||kind==='restart')game.restart();
  started=true;modal=null;$('overlay').hidden=true;$('pause').disabled=false;$('restart').disabled=false;$('pause').textContent='Pause';$('feedback').textContent='Tap 2+ · tap powers to blast';save('earnlyBubblePopLevel',game.state().level);update();draw();
 }
 function resume(){paused=false;modal=null;$('overlay').hidden=true;$('pause').textContent='Pause';if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});draw();}
 function pause(){
  if(!started)return;if(busy)settle();if(!started)return;
  if(paused){resume();return;}paused=true;audio?.suspend();$('pause').textContent='Resume';overlay('pause','Take a breather.','Your goals, moves and score are saved for this round.','Resume →');$('play').focus({preventScroll:true});
 }
 $('play').addEventListener('click',()=>{if(modal==='pause')resume();else if(modal==='quit')location.href='games.html';else begin(modal);});
 $('cancel').addEventListener('click',resume);$('pause').addEventListener('click',pause);
 $('restart').addEventListener('click',()=>{if(!started)return;if(busy)settle();if(!started)return;paused=true;audio?.suspend();$('pause').textContent='Resume';overlay('restart','Retry this level?','This level’s score will reset. Completed levels stay cleared.','Restart level →');$('play').focus({preventScroll:true});});
 document.querySelectorAll('.leave').forEach(link=>link.addEventListener('click',event=>{if(!started)return;event.preventDefault();if(busy)settle();if(!started){location.href='games.html';return;}paused=true;audio?.suspend();$('pause').textContent='Resume';overlay('quit','Leave this round?','Your unlocked level is saved. This round will restart when you return.','Quit to games');$('play').focus({preventScroll:true});}));
 $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Turn sound off':'Turn sound on');if(sound&&!paused)tone('pop');else audio?.suspend();});
 canvas.addEventListener('pointerdown',event=>{event.preventDefault();const r=canvas.getBoundingClientRect(),g=geometry(),x=Math.floor((event.clientX-r.left-g.x)/g.size),y=Math.floor((event.clientY-r.top-g.y)/g.size);if(x>=0&&x<E.COLS&&y>=0&&y<E.ROWS)act(y*E.COLS+x);});
 canvas.addEventListener('keydown',event=>{if(!started||paused||busy)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key))event.preventDefault();if(event.key==='ArrowLeft')selected=Math.max(0,selected-1);if(event.key==='ArrowRight')selected=Math.min(E.COLS*E.ROWS-1,selected+1);if(event.key==='ArrowUp')selected=Math.max(0,selected-E.COLS);if(event.key==='ArrowDown')selected=Math.min(E.COLS*E.ROWS-1,selected+E.COLS);if(event.key==='Enter'||event.key===' ')act(selected);else draw();});
 canvas.addEventListener('focus',draw);canvas.addEventListener('blur',draw);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio?.suspend();if(busy)settle();if(started&&!paused)pause();}});
 media.addEventListener('change',()=>{if(media.matches&&busy)settle();});
 overlay('start','Make it pop.',goalText(game.state())+` in ${game.state().moves} moves.`,'Let’s play →',tip(game.state()));new ResizeObserver(layout).observe(canvas);layout();update();
})();
