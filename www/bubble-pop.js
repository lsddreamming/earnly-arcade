(()=>{'use strict';
 const E=BubblePopEngine,$=id=>document.getElementById(id),canvas=$('board'),ctx=canvas.getContext('2d');
 const palette=['#ff729c','#73aaff','#ffcf63','#6ce5bf','#bf98ff'],symbols=['♥','◆','✿','●','✦'],names=['pink','blue','yellow','green','violet'];
 let savedLevel=0,best=0,unlocked=0,failures={};
 try{savedLevel=Number(localStorage.getItem('earnlyBubblePopLevel'))||0;best=Number(localStorage.getItem('earnlyBubblePopPreviewBest'))||0;unlocked=Math.max(E.normalizeLevel(savedLevel),E.normalizeLevel(localStorage.getItem('earnlyBubblePopUnlocked')));const data=JSON.parse(localStorage.getItem('earnlyBubblePopRetries')||'{}');if(data&&typeof data==='object')failures=data;}catch{}
 let game=E.create(Math.random,savedLevel);const media=matchMedia('(prefers-reduced-motion: reduce)');
 let guided=false,round=null,steps=[],opening=false,rewardGeneration=0;
 const rewardText=$('coinReward');
 function rewardError(e){if(e.message==='LEVEL_LOCKED')return 'Complete earlier levels in your coin journey first. Your preview unlocks stay available for practice.';return e.message==='DAILY_REWARD_LIMIT'?'Daily coin limit reached. Rewards saved; retry tomorrow within 24 hours.':e.message==='SIGN_IN_REQUIRED'?'Sign in to the same account to collect these coins.':e.message==='ROUND_EXPIRED'?'Reward session expired. Replay this level to earn its first-clear coins.':'Coins pending. Tap Retry coins when connected.';}
 async function collect(){const generation=++rewardGeneration;rewardText.textContent='Verifying coins…';$('retryCoins').hidden=true;try{const r=await BubblePopRewards.claim(round,steps.slice());if(generation!==rewardGeneration)return;rewardText.textContent=r.duplicate?'Coins already collected for this level.':`+${r.amount+r.bonus} Arcade Coins · ${r.amount} level${r.bonus?' + 100 milestone':''} · Balance ${Number(r.wallet.balance).toLocaleString()}`;}catch(e){if(generation!==rewardGeneration)return;rewardText.textContent=rewardError(e);$('retryCoins').hidden=e.message==='LEVEL_LOCKED';}}
 $('retryCoins').addEventListener('click',collect);
 $('coinJourney').addEventListener('click',()=>{if(!round||round.nextRewardLevel>=game.state().level)return;const target=round.nextRewardLevel;started=false;paused=false;document.body.classList.remove('is-playing');game.reset(target);round=null;showStart();update();draw();});
 let started=false,paused=false,busy=false,selected=0,sound=false,audio=null,raf=0,timer=0,w=420,h=480,transition=null,modal='start',returnFocus=null,anchor=null,pointer=null,waveQueue=[],hintPair=null,swapMotion=null;
 const save=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};
 function geometry(){const size=Math.min((w-12)/E.COLS,(h-12)/E.ROWS);return {size,x:(w-size*E.COLS)/2,y:(h-size*E.ROWS)/2};}
 function star(x,y,r){ctx.beginPath();for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,rr=k%2?r*.45:r;ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}ctx.closePath();ctx.fill();}
 function bubble(c,x,y,r,alpha=1){
  ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,alpha));
  if(c.star){ctx.shadowColor='#ffd45c';ctx.shadowBlur=r*.55;ctx.fillStyle='#6d441b';ctx.beginPath();ctx.roundRect(x-r*.9,y-r*.9,r*1.8,r*1.8,r*.3);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#fff2a6';ctx.lineWidth=Math.max(2,r*.1);ctx.stroke();ctx.fillStyle='#ffdf68';star(x,y,r*.83);ctx.fillStyle='#fff9dc';star(x-r*.13,y-r*.16,r*.28);ctx.restore();return;}
  ctx.fillStyle='#05091c';ctx.beginPath();ctx.arc(x,y+3,r,0,Math.PI*2);ctx.fill();
  const gradient=ctx.createRadialGradient(x-r*.35,y-r*.4,r*.05,x,y,r);gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.28,c.power?(c.power==='bomb'?'#d5b8ff':c.power==='prism'?'#f4caff':'#c9f8ff'):palette[c.color]);gradient.addColorStop(1,c.power?'#6554ba':['#b72e73','#3554c4','#d17a25','#209d91','#7443bd'][c.color]);ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  // Original hand-drawn glass shell: a luminous rim, curved reflection and color emblem.
  ctx.strokeStyle='#ffffff65';ctx.lineWidth=Math.max(1,r*.045);ctx.beginPath();ctx.arc(x,y,r*.96,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#ffffffc0';ctx.lineWidth=r*.11;ctx.lineCap='round';ctx.beginPath();ctx.arc(x,y,r*.73,Math.PI*1.12,Math.PI*1.57);ctx.stroke();
  ctx.fillStyle='#ffffffa0';ctx.beginPath();ctx.ellipse(x+r*.32,y+r*.52,r*.15,r*.065,-.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#18243e';ctx.textAlign='center';ctx.textBaseline='middle';
  if(c.power==='prism'){ctx.fillStyle='#fff7d5';star(x,y,r*.65);ctx.fillStyle='#b166dc';star(x,y,r*.28);}else if(c.power==='bomb'){
   ctx.fillStyle='#493064';ctx.beginPath();ctx.arc(x,y+2,r*.43,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#493064';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-r*.25);ctx.quadraticCurveTo(x+r*.1,y-r*.75,x+r*.45,y-r*.5);ctx.stroke();ctx.fillStyle='#fff4a4';star(x+r*.47,y-r*.49,r*.18);
  }else if(c.power){
   ctx.translate(x,y);if(c.power==='vertical')ctx.rotate(Math.PI/2);ctx.fillStyle='#6453ac';ctx.fillRect(-r*.4,-r*.15,r*.8,r*.3);ctx.beginPath();ctx.moveTo(-r*.7,0);ctx.lineTo(-r*.25,-r*.4);ctx.lineTo(-r*.25,r*.4);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(r*.7,0);ctx.lineTo(r*.25,-r*.4);ctx.lineTo(r*.25,r*.4);ctx.closePath();ctx.fill();
  }else{
   ctx.save();ctx.translate(x,y+r*.08);ctx.scale(r*.48,r*.48);ctx.fillStyle=['#8c225a','#213f9e','#966012','#126b60','#582990'][c.color];
   ctx.beginPath();
   if(c.color===0){ctx.moveTo(0,.8);ctx.bezierCurveTo(-2,-.4,-.6,-1.6,0,-.6);ctx.bezierCurveTo(.6,-1.6,2,-.4,0,.8);}
   else if(c.color===1){ctx.moveTo(0,-1);ctx.lineTo(.8,0);ctx.lineTo(0,1);ctx.lineTo(-.8,0);}
   else if(c.color===2){for(let k=0;k<6;k++){const a=k*Math.PI/3;ctx.moveTo(0,0);ctx.ellipse(Math.cos(a)*.52,Math.sin(a)*.52,.48,.27,a,0,Math.PI*2);}}
   else if(c.color===3){ctx.moveTo(-.7,.65);ctx.bezierCurveTo(-1.2,-.7,0,-1, .8,-.8);ctx.bezierCurveTo(1,.1,.5,1,-.7,.65);}
   else {for(let k=0;k<8;k++){const a=k*Math.PI/4,rr=k%2?.38:1;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}}
   ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.restore();
 }
 function iceTiles(ice,g){ice.forEach((f,i)=>{if(!f)return;const x=g.x+(i%E.COLS)*g.size+2,y=g.y+Math.floor(i/E.COLS)*g.size+2;ctx.fillStyle='#83e9ff32';ctx.fillRect(x,y,g.size-4,g.size-4);ctx.strokeStyle='#d6f8ff';ctx.lineWidth=2.5;ctx.strokeRect(x+2,y+2,g.size-8,g.size-8);ctx.beginPath();ctx.moveTo(x+4,y+g.size*.3);ctx.lineTo(x+g.size*.3,y+4);ctx.moveTo(x+g.size*.7,y+g.size-4);ctx.lineTo(x+g.size-4,y+g.size*.7);ctx.stroke();});}
 function draw(){
  if(raf){cancelAnimationFrame(raf);raf=0;}
  ctx.clearRect(0,0,w,h);const s=swapMotion?swapMotion.before:transition?{...game.state(),board:transition.board,ice:transition.ice}:game.state(),g=geometry(),now=performance.now(),t=transition?Math.min(1,(now-transition.start)/400):1;
  const center=i=>({x:g.x+(i%E.COLS+.5)*g.size,y:g.y+(Math.floor(i/E.COLS)+.5)*g.size});
  for(let i=0;i<56;i++){const p=center(i);ctx.fillStyle=(i%7+Math.floor(i/7))%2?'#c2e5ff10':'#080d2530';ctx.beginPath();ctx.roundRect(p.x-g.size*.48,p.y-g.size*.48,g.size*.96,g.size*.96,8);ctx.fill();}iceTiles(transition&&t<.3?transition.oldIce:s.ice,g);
  if(swapMotion){const m=swapMotion,q=Math.min(1,(now-m.start)/m.duration),f=m.revert?Math.sin(q*Math.PI):1-Math.pow(1-q,3);s.board.forEach((c,i)=>{const p=center(i),target=center(i===m.a?m.b:i===m.b?m.a:i);bubble(c,p.x+(target.x-p.x)*f,p.y+(target.y-p.y)*f,g.size*.405);});if(q<1)raf=requestAnimationFrame(draw);return;}
  if(transition&&t<.3){
   transition.old.forEach((c,i)=>{const p=center(i),pop=transition.cleared.includes(i);bubble(c,p.x,p.y,g.size*.405*(pop?1+Math.sin(t/.3*Math.PI)*.2:1),pop?1-Math.pow(t/.3,3):1);});
  }else{
   const progress=transition?1-Math.pow(1-Math.min(1,(t-.3)/.7),3):1;
   s.board.forEach((c,i)=>{const p=center(i),fall=transition?.falls[i];let y=p.y;if(fall)y=g.y+(.5+fall.from+(fall.to-fall.from)*progress)*g.size;bubble(c,p.x,y,g.size*.405);});
  }
  if(!transition){
   s.board.forEach((c,i)=>{if(!c.power)return;for(const n of E.neighbors(i))if(n>i&&s.board[n].power){const a=center(i),b=center(n);ctx.strokeStyle='#f8d983';ctx.lineWidth=3;ctx.beginPath();const dx=(b.x-a.x)*.43,dy=(b.y-a.y)*.43;ctx.moveTo(a.x+dx,a.y+dy);ctx.lineTo(b.x-dx,b.y-dy);ctx.stroke();}});
   if(hintPair){for(const i of hintPair){const p=center(i);ctx.strokeStyle='#fff1b1';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(p.x-g.size*.46,p.y-g.size*.46,g.size*.92,g.size*.92,12);ctx.stroke();}
    if(guided){const a=center(hintPair[0]),b=center(hintPair[1]);ctx.save();ctx.translate((a.x+b.x)/2,(a.y+b.y)/2);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));ctx.strokeStyle='#fff';ctx.shadowColor='#081126';ctx.shadowBlur=5;ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-g.size*.28,0);ctx.lineTo(g.size*.25,0);ctx.lineTo(g.size*.08,-g.size*.14);ctx.moveTo(g.size*.25,0);ctx.lineTo(g.size*.08,g.size*.14);ctx.stroke();ctx.restore();}
   }
   if(canvas===document.activeElement||anchor!==null){const p=center(anchor??selected);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,g.size*.46,0,Math.PI*2);ctx.stroke();}
  }
  if(transition){
   ctx.save();ctx.globalAlpha=Math.max(0,1-t);
   for(const i of transition.cleared){const p=center(i);ctx.strokeStyle=palette[transition.old[i].color]||'#dfc6ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,g.size*(.25+t*.5),0,Math.PI*2);ctx.stroke();
    // Six bounded sparkles per popped bubble, drawn only during the cascade.
    for(let k=0;k<6;k++){const angle=k*Math.PI/3+i,travel=g.size*(.25+t*.9),px=p.x+Math.cos(angle)*travel,py=p.y+Math.sin(angle)*travel+t*t*12;ctx.fillStyle=palette[transition.old[i].color]||'#ffe8a4';star(px,py,g.size*.055*(1-t));}
   }
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
 function tip(s){if(s.level<3)return 'Swipe one bubble toward a neighbor. Match 3 of the same color to collect them.';return 'Swap neighbors to match 3. '+( s.goals.stars?'Match below gold stars to deliver them.':s.goals.ice?'Make matches on icy tiles to break them.':'Match 4 for a rocket · 5 for a prism · T/L for a bomb.');}
 function update(){
  const s=game.state(),g=s.goals;$('score').textContent=s.score.toLocaleString();$('moves').textContent=s.moves;$('moves').classList.toggle('urgent',s.moves<=5);$('best').textContent=best.toLocaleString();$('levelLabel').textContent=`LEVEL ${s.level+1} / ${s.levelCount}`;$('levelName').textContent=s.name;$('goalHint').textContent=g.stars?'Drop gold stars to the bottom — clear bubbles below them':g.ice?'Match bubbles inside frosty squares to break the ice':'Collect '+names[g.color]+' bubbles';$('combo').textContent=s.combo>1?'COMBO ×'+s.combo:'';
  $('progressFill').style.width=Math.round(s.progress*100)+'%';$('progressText').textContent=Math.round(s.progress*100)+'%';$('chapter').textContent=E.THEMES[Math.floor(s.level/10)%4];renderJourney(s);const goals=[];if(g.collect)goals.push({symbol:symbols[g.color],color:palette[g.color],label:names[g.color],n:g.collected,total:g.collect});if(g.ice)goals.push({symbol:'❄',color:'#9ce8ff',label:'ice',n:g.ice-g.iceLeft,total:g.ice});if(g.stars)goals.push({symbol:'★',color:'#ffe18b',label:'stars',n:g.delivered,total:g.stars});
  $('goals').replaceChildren(...goals.map(goal=>{const el=document.createElement('div');el.className='goal'+(goal.n>=goal.total?' done':'');el.setAttribute('aria-label',`${goal.label}: ${Math.min(goal.n,goal.total)} of ${goal.total}`);const fill=document.createElement('span');fill.className='goal-fill';fill.style.width=Math.min(100,goal.n/goal.total*100)+'%';const label=document.createElement('span');label.className='goal-label';const name=document.createElement('span');name.textContent=goal.symbol+' '+goal.label;name.style.setProperty('--goal-color',goal.color);name.className='goal-symbol';const count=document.createElement('b');count.textContent=goal.n>=goal.total?'✓':(goal.total-goal.n)+' left';label.append(name,count);el.append(fill,label);return el;}));
 }
 function tone(kind,count=2){
  if(!sound||document.hidden)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();audio.resume();const notes=kind==='win'?[523,659,784,1047]:kind==='blast'?[120,240,480]:[380+Math.min(count,12)*25,620+Math.min(count,12)*25];notes.forEach((freq,i)=>{const o=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+i*.055;o.type=kind==='blast'?'triangle':'sine';o.frequency.setValueAtTime(freq,start);o.frequency.exponentialRampToValueAtTime(freq*1.3,start+.12);gain.gain.setValueAtTime(.045,start);gain.gain.exponentialRampToValueAtTime(.001,start+.18);o.connect(gain);gain.connect(audio.destination);o.start(start);o.stop(start+.2);o.onended=()=>{o.disconnect();gain.disconnect();};});}catch{}
 }
 function renderJourney(s){const start=Math.max(0,Math.min(993,s.level-3));$('journey').replaceChildren(...Array.from({length:7},(_,k)=>{const level=start+k,b=document.createElement('button');b.textContent=level+1;b.className=level===s.level?'current':level<unlocked?'cleared':'';b.disabled=level>unlocked||started;b.setAttribute('aria-label',`Level ${level+1}${level>unlocked?' locked':level<unlocked?' cleared':''}`);if(level===s.level)b.setAttribute('aria-current','step');b.onclick=()=>{game.reset(level);save('earnlyBubblePopLevel',level);showStart();update();draw();};return b;}));}
 function overlay(mode,title,text,button,extra=''){
  const earlier=round&&Number.isInteger(round.nextRewardLevel)&&round.nextRewardLevel<game.state().level;$('coinJourney').hidden=!(earlier&&['pause','won','complete','lost'].includes(mode));if(earlier)$('coinJourney').textContent='Earn from level '+(round.nextRewardLevel+1);
  $('overlay').dataset.state=mode;rewardGeneration++;rewardText.textContent='';$('retryCoins').hidden=true;
  $('assist').hidden=mode!=='lost'||Number(failures[game.state().level]||0)<3;modal=mode;returnFocus=document.activeElement;$('overlayTag').textContent=`LEVEL ${game.state().level+1} · ${game.state().name.toUpperCase()}`;$('resultTitle').textContent=title;$('resultText').textContent=text;$('play').textContent=button;$('overlayTip').textContent=extra;$('cancel').hidden=!['restart','quit'].includes(mode);$('overlay').hidden=false;
 }
 function end(){
  started=false;paused=false;document.body.classList.remove('is-playing');const s=game.state();if(s.score>best){best=s.score;save('earnlyBubblePopPreviewBest',best);}update();$('pause').disabled=true;$('restart').disabled=true;$('hint').disabled=true;
  if(s.status==='won'){
   failures[s.level]=0;save('earnlyBubblePopRetries',JSON.stringify(failures));unlocked=Math.max(unlocked,Math.min(999,s.level+1));save('earnlyBubblePopUnlocked',unlocked);tone('win');const last=s.level===s.levelCount-1;save('earnlyBubblePopLevel',last?0:s.level+1);
   overlay(last?'complete':'won',last?`All ${s.levelCount.toLocaleString()} cleared!`:'Level cleared!',`${s.assisted?'Assisted · ':''}${s.moves>=8?'★★★':s.moves>=3?'★★':'★'} · ${s.levelScore.toLocaleString()} points`,last?'Play from level 1 →':'Next level →',last?'Try building bigger power-up combos on your next run.':`Next: ${E.levelRules(s.level+1).name}`);
  if(round)collect();else rewardText.textContent='Practice round · Sign in before playing to earn first-clear coins.';
  }else {failures[s.level]=Math.min(99,Number(failures[s.level]||0)+1);save('earnlyBubblePopRetries',JSON.stringify(failures));overlay('lost',s.progress>=.75?'Nearly there!':'Try a new approach',Math.round(s.progress*100)+'% of your goals complete.','Try again →',Number(failures[s.level])>=3?'Want a helping hand? Retry with 3 extra moves, free.':'Look for a match of 4, or combine two special bubbles.');}update();
  $('play').focus({preventScroll:true});
 }
 function settle(){update();clearTimeout(timer);timer=0;cancelAnimationFrame(raf);raf=0;transition=null;swapMotion=null;waveQueue=[];busy=false;hintPair=null;draw();if(started&&game.state().done)end();}
 function animateWave(){
  const wave=waveQueue.shift();if(!wave){settle();return;}transition={...wave,start:performance.now()};const number=game.state().combo-waveQueue.length;$('combo').textContent=number>1?'COMBO ×'+number:'';if(number>1){$('feedback').textContent=(number>=3?'Bubble bliss!':'Sweet cascade!')+' +'+wave.points.toLocaleString();}tone(wave.blasts.length?'blast':'pop',Math.min(12,wave.cleared.length));draw();timer=setTimeout(animateWave,400);
 }
 function act(a,b){
  if(!started||paused||busy)return;const before=game.state(),result=game.swap(a,b);anchor=null;
  if(!result.valid){$('feedback').textContent=before.board[a]?.star||before.board[b]?.star?'Match below stars to deliver them':'Swap neighbors to match 3 — no move used';if(!media.matches&&E.neighbors(a).includes(b)&&!before.board[a]?.star&&!before.board[b]?.star){busy=true;swapMotion={before,a,b,revert:true,start:performance.now(),duration:220};timer=setTimeout(settle,220);}draw();return;}
  steps.push([a,b]);busy=true;guided=false;selected=b;hintPair=null;
  const labels={'double-bomb':'SUPERNOVA!','double-rocket':'CROSS BLAST!','rocket-bomb':'ROCKET STORM!','double-prism':'FULL SPECTRUM!','prism-power':'PRISM PARTY!'};
  $('feedback').textContent=(labels[result.powerCombo]||(result.combo>=3?'Brilliant cascade!':result.combo>1?'Chain reaction!':result.createdPower==='prism'?'Prism ready!':result.createdPower==='bomb'?'Bomb ready!':result.createdPower?'Rocket ready!':'Nice match!'))+' +'+result.points.toLocaleString();
  if(result.rearranged)$('feedback').textContent+=' · Board refreshed';update();
  if(media.matches){tone(result.powerCombo?'blast':'pop',result.count);settle();return;}waveQueue=result.waves.slice();swapMotion={before,a,b,start:performance.now(),duration:140};draw();timer=setTimeout(()=>{swapMotion=null;animateWave();},140);
 }
 function select(i){if(!started||paused||busy)return;if(!guided)hintPair=null;if(anchor!==null&&E.neighbors(anchor).includes(i)){act(anchor,i);return;}anchor=anchor===i?null:i;selected=i;draw();}
 function openingHint(){
  const s=game.state();return game.legalMoves().map(pair=>{const board=s.board.map(c=>({...c}));[board[pair[0]],board[pair[1]]]=[board[pair[1]],board[pair[0]]];const target=E.matches(board).reduce((n,run)=>n+run.indices.filter(i=>board[i].color===s.goals.color).length,0);return {pair,target};}).sort((a,b)=>b.target-a.target)[0]?.pair;
 }
 async function begin(kind){
  if(opening)return false;opening=true;$('play').disabled=true;
  let target=game.state().level;if(kind==='won')target++;else if(kind==='complete')target=0;
  round=null;steps=[];try{round=await window.BubblePopRewards?.start(target);}catch{}
  opening=false;$('play').disabled=false;
  clearTimeout(timer);cancelAnimationFrame(raf);transition=null;swapMotion=null;waveQueue=[];anchor=null;hintPair=null;pointer=null;busy=false;paused=false;
  if(kind==='won')game.next();else if(kind==='complete')game.reset(0);else if(kind==='lost'||kind==='restart')game.restart();
  if(round)game.reseed(round.seed);
  document.querySelector('.note').textContent=round&&round.nextRewardLevel<target?`Practice level · Earn coins from level ${round.nextRewardLevel+1} (Pause → Earn from level). Your unlocks stay saved.`:round?'First-clear coins active · 15–35 + milestone bonus · 9 rewarded levels daily':'Practice · Sign in before playing to earn coins. If already signed in, check your connection.';
  started=true;document.body.classList.add('is-playing');modal=null;$('overlay').hidden=true;$('pause').disabled=false;$('restart').disabled=false;$('hint').disabled=false;$('pause').textContent='Pause';$('feedback').textContent='Swipe to match 3';guided=game.state().level===0&&game.state().moves===E.levelRules(0).moves;if(guided){hintPair=openingHint();$('feedback').textContent='Swipe the outlined bubbles in the arrow direction';}save('earnlyBubblePopLevel',game.state().level);update();draw();
 }
 function resume(){paused=false;modal=null;$('overlay').hidden=true;$('pause').textContent='Pause';if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});draw();}
 function pause(){
  if(!started)return;if(busy)settle();if(!started)return;
  if(paused){resume();return;}paused=true;pointer=null;anchor=null;audio?.suspend();$('pause').textContent='Resume';overlay('pause','Take a breather.','Your goals, moves and score are saved for this round.','Resume →');$('play').focus({preventScroll:true});
 }
 $('hint').addEventListener('click',()=>{if(!started||paused||busy)return;guided=false;hintPair=openingHint();anchor=null;$('feedback').textContent='Try swapping the two outlined bubbles';draw();});
 $('assist').addEventListener('click',async()=>{if(modal!=='lost'||Number(failures[game.state().level]||0)<3)return;await begin('lost');game.assist();steps.push('assist');$('feedback').textContent='Helping hand: +3 moves · assisted round';update();draw();});
 $('play').addEventListener('click',()=>{if(modal==='pause')resume();else if(modal==='quit')location.href='games.html';else begin(modal);});
 $('cancel').addEventListener('click',resume);$('pause').addEventListener('click',pause);
 $('restart').addEventListener('click',()=>{if(!started)return;if(busy)settle();if(!started)return;paused=true;audio?.suspend();$('pause').textContent='Resume';overlay('restart','Retry this level?','This level’s score will reset. Completed levels stay cleared.','Restart level →');$('play').focus({preventScroll:true});});
 document.querySelectorAll('.leave').forEach(link=>link.addEventListener('click',event=>{if(!started)return;event.preventDefault();if(busy)settle();if(!started){location.href='games.html';return;}paused=true;audio?.suspend();$('pause').textContent='Resume';overlay('quit','Leave this round?','Your unlocked level is saved. This round will restart when you return.','Quit to games');$('play').focus({preventScroll:true});}));
 $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Turn sound off':'Turn sound on');if(sound&&!paused)tone('pop');else audio?.suspend();});
 function indexAt(event){const r=canvas.getBoundingClientRect(),g=geometry(),x=Math.floor((event.clientX-r.left-g.x)/g.size),y=Math.floor((event.clientY-r.top-g.y)/g.size);return x>=0&&x<7&&y>=0&&y<8?y*7+x:-1;}
 canvas.addEventListener('pointerdown',event=>{if(!started||paused||busy||pointer)return;event.preventDefault();const i=indexAt(event);if(i<0)return;pointer={id:event.pointerId,i,x:event.clientX,y:event.clientY};try{canvas.setPointerCapture(event.pointerId);}catch{}});
 canvas.addEventListener('pointerup',event=>{if(!pointer||pointer.id!==event.pointerId)return;event.preventDefault();const p=pointer;pointer=null;if(!started||paused||busy)return;const dx=event.clientX-p.x,dy=event.clientY-p.y;if(Math.hypot(dx,dy)<geometry().size*.25){select(p.i);return;}const j=p.i+(Math.abs(dx)>Math.abs(dy)?(dx>0?1:-1):(dy>0?7:-7));if(E.neighbors(p.i).includes(j))act(p.i,j);});
 canvas.addEventListener('pointercancel',()=>{pointer=null;});canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
 canvas.addEventListener('keydown',event=>{if(!started||paused||busy)return;const deltas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(event.key in deltas){event.preventDefault();const j=selected+deltas[event.key];if(E.neighbors(selected).includes(j)){if(event.shiftKey)act(selected,j);else selected=j;}draw();}else if(event.key==='Enter'||event.key===' '){event.preventDefault();select(selected);}else if(event.key==='Escape'){anchor=null;draw();}});
 canvas.addEventListener('focus',draw);canvas.addEventListener('blur',draw);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio?.suspend();if(busy)settle();if(started&&!paused)pause();}});
 media.addEventListener('change',()=>{if(media.matches&&busy)settle();});
 window.addEventListener('online',()=>BubblePopRewards?.retry().catch(()=>{}));
 function showStart(){const opening=game.state();overlay('start',opening.level?'Ready for level '+(opening.level+1)+'?':'Match. Pop. Smile.',goalText(opening)+` in ${opening.moves} moves.`,opening.level?'Continue level '+(opening.level+1)+' →':'Let’s play →',tip(opening));const tag=$('overlayTag');tag.textContent='Practice · sign in to earn';window.BubblePopRewards?.isSignedIn?.().then(signedIn=>{if(modal==='start'&&started===false)tag.textContent=signedIn?'Signed in · first-clear coins available':'Practice · sign in to earn';}).catch(()=>{});}showStart();new ResizeObserver(layout).observe(canvas);layout();update();
})();
